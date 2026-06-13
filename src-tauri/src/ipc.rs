use tauri_specta::{collect_commands, Builder};

use crate::features::connections::commands as connections;

pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        // --- connections ---
        connections::connections_list,
        connections::connection_create,
        connections::connection_update,
        connections::connection_set_favorite,
        connections::connection_delete,
    ])
}
