use tauri_specta::{collect_commands, collect_events, Builder};

use crate::features::connections::commands as connections;
use crate::features::profiles::commands as profiles;
use crate::features::secrets::commands as secrets;
use crate::features::ssh::commands as ssh;
use crate::features::ssh::{HostKeyPrompt, SshClosed, SshOutput};

pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            // --- connections ---
            connections::connections_list,
            connections::connection_create,
            connections::connection_update,
            connections::connection_set_favorite,
            connections::connection_delete,
            // --- profiles ---
            profiles::profiles_list,
            profiles::profile_create,
            profiles::profile_update,
            profiles::profile_delete,
            profiles::profile_delete_password,
            // --- secrets ---
            secrets::secret_has_password,
            secrets::secret_delete_password,
            // --- ssh ---
            ssh::ssh_connect,
            ssh::ssh_authenticate_password,
            ssh::ssh_host_key_decision,
            ssh::ssh_write,
            ssh::ssh_resize,
            ssh::ssh_disconnect,
            // --- sftp ---
            ssh::sftp_read_dir,
            ssh::sftp_home_dir,
            ssh::sftp_read_file,
            ssh::sftp_download,
            ssh::sftp_upload_path,
            ssh::sftp_remove,
        ])
        .events(collect_events![SshOutput, SshClosed, HostKeyPrompt])
}
