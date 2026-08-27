//! Console connections: a saved serial line, and the transport that opens one.
//!
//! The record is its own table, not a variant of an SSH connection. Once open,
//! a session is driven through [`crate::features::terminal`] like any other.

pub mod commands;
mod ports;
mod session;
pub mod settings;
pub mod store;
