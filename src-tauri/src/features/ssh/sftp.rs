use std::collections::HashMap;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::Arc;

use parking_lot::Mutex;
use russh_sftp::client::SftpSession;
use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex as AsyncMutex;

use super::session::SessionHandle;

pub(super) struct SftpSlot {
    handle: SessionHandle,
    session: AsyncMutex<Option<Arc<SftpSession>>>,
}

impl SftpSlot {
    pub(super) fn new(handle: SessionHandle) -> Self {
        Self {
            handle,
            session: AsyncMutex::new(None),
        }
    }
}

#[derive(Default)]
pub struct SftpSessions(pub(super) Mutex<HashMap<String, Arc<SftpSlot>>>);

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SftpKind {
    File,
    Dir,
    Symlink,
    Other,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub kind: SftpKind,
    pub size: f64,
    pub modified: Option<u32>,
    pub mode: Option<u32>,
}

async fn session_for(app: &AppHandle, session_id: &str) -> anyhow::Result<Arc<SftpSession>> {
    let slot = {
        let sessions = app.state::<SftpSessions>();
        let guard = sessions.0.lock();
        guard.get(session_id).cloned()
    };
    let Some(slot) = slot else {
        anyhow::bail!("no active session");
    };

    let mut cell = slot.session.lock().await;
    if let Some(existing) = cell.as_ref() {
        return Ok(existing.clone());
    }

    let channel = slot.handle.channel_open_session().await?;
    channel.request_subsystem(true, "sftp").await?;
    let sftp = Arc::new(SftpSession::new(channel.into_stream()).await?);
    *cell = Some(sftp.clone());
    Ok(sftp)
}

pub async fn read_dir(
    app: AppHandle,
    session_id: String,
    path: String,
) -> anyhow::Result<Vec<SftpEntry>> {
    let sftp = session_for(&app, &session_id).await?;
    let mut entries = Vec::new();
    for entry in sftp.read_dir(path).await? {
        let meta = entry.metadata();
        let kind = if meta.is_dir() {
            SftpKind::Dir
        } else if meta.is_symlink() {
            SftpKind::Symlink
        } else if meta.is_regular() {
            SftpKind::File
        } else {
            SftpKind::Other
        };
        entries.push(SftpEntry {
            name: entry.file_name(),
            path: entry.path(),
            kind,
            size: meta.size.unwrap_or(0) as f64,
            modified: meta.mtime,
            mode: meta.permissions,
        });
    }
    Ok(entries)
}

pub async fn home_dir(app: AppHandle, session_id: String) -> anyhow::Result<String> {
    let sftp = session_for(&app, &session_id).await?;
    Ok(sftp.canonicalize(".").await?)
}

const PREVIEW_MAX_BYTES: u64 = 2 * 1024 * 1024;


pub async fn read_file(
    app: AppHandle,
    session_id: String,
    path: String,
) -> anyhow::Result<Vec<u8>> {
    let sftp = session_for(&app, &session_id).await?;
    if let Some(size) = sftp.metadata(path.clone()).await?.size {
        if size > PREVIEW_MAX_BYTES {
            anyhow::bail!("file is too large to preview");
        }
    }
    Ok(sftp.read(path).await?)
}

pub async fn download(
    app: AppHandle,
    session_id: String,
    remote_path: String,
    local_path: String,
) -> anyhow::Result<()> {
    let sftp = session_for(&app, &session_id).await?;
    let mut remote = sftp.open(remote_path).await?;
    let mut local = tokio::fs::File::create(&local_path).await?;
    tokio::io::copy(&mut remote, &mut local).await?;
    local.flush().await?;
    Ok(())
}

pub async fn remove(app: AppHandle, session_id: String, path: String) -> anyhow::Result<()> {
    let sftp = session_for(&app, &session_id).await?;
    if sftp.symlink_metadata(path.clone()).await?.is_dir() {
        remove_dir_recursive(&sftp, path).await
    } else {
        sftp.remove_file(path).await?;
        Ok(())
    }
}

fn remove_dir_recursive(
    sftp: &SftpSession,
    path: String,
) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + '_>> {
    Box::pin(async move {
        for entry in sftp.read_dir(path.as_str()).await? {
            let child = entry.path();
            if entry.metadata().is_dir() {
                remove_dir_recursive(sftp, child).await?;
            } else {
                sftp.remove_file(child).await?;
            }
        }
        sftp.remove_dir(path).await?;
        Ok(())
    })
}

fn join_remote(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}

pub async fn upload_path(
    app: AppHandle,
    session_id: String,
    local_path: String,
    remote_dir: String,
) -> anyhow::Result<()> {
    let sftp = session_for(&app, &session_id).await?;
    let local = PathBuf::from(&local_path);
    let name = local
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| anyhow::anyhow!("invalid local path"))?;
    upload_entry(&sftp, &local, &join_remote(&remote_dir, &name)).await
}

async fn ensure_remote_dir(sftp: &SftpSession, remote: &str) -> anyhow::Result<()> {
    match sftp.symlink_metadata(remote.to_string()).await {
        Ok(meta) if meta.is_dir() => Ok(()),
        Ok(_) => anyhow::bail!("remote path exists and is not a directory"),
        Err(_) => {
            sftp.create_dir(remote.to_string()).await?;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests;

fn upload_entry<'a>(
    sftp: &'a SftpSession,
    local: &'a Path,
    remote: &'a str,
) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send + 'a>> {
    Box::pin(async move {
        if tokio::fs::metadata(local).await?.is_dir() {
            ensure_remote_dir(sftp, remote).await?;
            let mut dir = tokio::fs::read_dir(local).await?;
            while let Some(entry) = dir.next_entry().await? {
                let child_local = entry.path();
                let child_name = entry.file_name().to_string_lossy().into_owned();
                upload_entry(sftp, &child_local, &join_remote(remote, &child_name)).await?;
            }
        } else {
            let mut local_file = tokio::fs::File::open(local).await?;
            let mut remote_file = sftp.create(remote.to_string()).await?;
            tokio::io::copy(&mut local_file, &mut remote_file).await?;
            remote_file.shutdown().await?;
        }
        Ok(())
    })
}
