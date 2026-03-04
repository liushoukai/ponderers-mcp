use rmcp::*;
use rmcp::model::{CallToolResult, ServerInfo, ServerCapabilities, Content};
use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::wrapper::Parameters;
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
pub struct ModelDetailParams {
    /// 模型ID，例如: openai/gpt-4o
    pub id: String,
}

#[derive(Clone)]
pub struct ToolsServer {
    // tool_router 字段是必需的，#[tool_handler] 宏会使用它
    tool_router: ToolRouter<Self>,
}

impl ToolsServer {
    pub fn new() -> Self {
        ToolsServer {
            // 调用由 #[tool_router] 宏自动生成的方法
            tool_router: Self::tool_router(),
        }
    }
}

// 使用 tool_router 宏标注工具方法所在的 impl 块
#[tool_router]
impl ToolsServer {
    /// 获取 OpenRouter 平台支持的所有模型列表
    #[tool(description = "获取 OpenRouter 平台支持的所有模型列表，包括模型ID、名称、描述、上下文长度和价格信息")]
    pub async fn get_openrouter_models(&self) -> Result<CallToolResult, ErrorData> {
        tracing::info!("收到获取 OpenRouter 模型列表请求");

        match crate::fetch_openrouter_models().await {
            Ok(resp) => {
                tracing::info!("成功获取模型列表，共 {} 个模型", resp.data.len());
                let mut output = format!("OpenRouter 模型列表（共 {} 个）:\n\n", resp.data.len());
                for model in &resp.data {
                    let created = model.created
                        .and_then(|ts| chrono::DateTime::from_timestamp(ts, 0))
                        .map(|dt| dt.format("%Y-%m-%d").to_string())
                        .unwrap_or_default();
                    output.push_str(&format!("{} | {} | {}\n", model.id, model.name, created));
                }
                Ok(CallToolResult::success(vec![Content::text(output)]))
            }
            Err(e) => {
                tracing::error!("获取 OpenRouter 模型列表失败: {}", e);
                Err(ErrorData::internal_error(format!("获取模型列表失败: {}", e), None))
            }
        }
    }

    /// 根据模型ID获取 OpenRouter 模型的详细信息
    #[tool(description = "根据模型ID获取 OpenRouter 模型的详细信息，包括名称、上下文长度和价格")]
    pub async fn get_openrouter_model_detail(
        &self,
        Parameters(params): Parameters<ModelDetailParams>,
    ) -> Result<CallToolResult, ErrorData> {
        tracing::info!("收到获取模型详情请求，模型ID: {}", params.id);

        match crate::fetch_openrouter_model(&params.id).await {
            Ok(Some(model)) => {
                tracing::info!("成功获取模型详情: {}", model.id);
                Ok(CallToolResult::success(vec![Content::text(model.to_string())]))
            }
            Ok(None) => {
                Err(ErrorData::invalid_params(format!("未找到模型: {}", params.id), None))
            }
            Err(e) => {
                tracing::error!("获取模型详情失败: {}", e);
                Err(ErrorData::internal_error(format!("获取模型详情失败: {}", e), None))
            }
        }
    }

    /// 获取当前机器的公网IP信息，包括IP地址、地理位置、ISP等
    #[tool(description = "获取当前机器的公网IP信息，包括IP地址、地理位置、ISP等")]
    pub async fn get_ip_info(&self) -> Result<CallToolResult, ErrorData> {
        tracing::info!("收到获取 IP 信息请求");
        tracing::debug!("正在调用 IP 信息 API...");

        match crate::fetch_ip_info().await {
            Ok(ip_info) => {
                tracing::info!("成功获取 IP 信息: {}", ip_info);
                let content = Content::text(ip_info.to_string());
                Ok(CallToolResult::success(vec![content]))
            }
            Err(e) => {
                tracing::error!("获取 IP 信息失败: {}", e);
                Err(ErrorData::internal_error(format!("获取IP信息失败: {}", e), None))
            }
        }
    }
}

// 使用 tool_handler 宏自动实现工具请求处理
#[tool_handler]
impl ServerHandler for ToolsServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some("通用工具集，提供公网 IP 查询、OpenRouter 模型列表及详情查询等功能".into()),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            ..Default::default()
        }
    }
}
