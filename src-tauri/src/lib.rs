mod db;
mod features;
mod ipc;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .try_init();

    features::secrets::store::init();

    let builder = ipc::builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            app.manage(features::terminal::TerminalSessions::default());
            app.manage(features::ssh::PendingConnections::default());
            app.manage(features::ssh::HostKeyPrompts::default());
            app.manage(features::ssh::KeyPassphrasePrompts::default());
            app.manage(features::ssh::SftpSessions::default());
            let db = db::init(app.handle())?;
            app.manage(db);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
