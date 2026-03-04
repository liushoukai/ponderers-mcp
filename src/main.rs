use rmcp::transport::stdio;
use rmcp::ServiceExt;
use rust_mcp_client::server::ToolsServer;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志
    // 可以通过环境变量 RUST_LOG 控制日志级别
    // 例如: RUST_LOG=debug 或 RUST_LOG=trace
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr) // 日志输出到 stderr,避免干扰 MCP 通信
        .with_target(true)
        .with_line_number(true)
        .init();

    tracing::info!("正在启动 MCP 工具服务器...");

    // 创建工具服务
    let service = ToolsServer::new();

    tracing::debug!("工具服务创建完成");

    // 使用 stdio 传输启动 MCP 服务器
    let server = service.serve(stdio()).await?;

    tracing::info!("MCP 服务器已启动，等待请求...");

    // 等待服务器结束
    server.waiting().await?;

    tracing::info!("MCP 服务器已关闭");

    Ok(())
}
