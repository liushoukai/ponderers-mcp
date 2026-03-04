pub mod server;

use serde::Deserialize;
use std::fmt;

#[derive(Deserialize, Debug)]
pub struct IpInfo {
    pub ip: String,
    pub city: String,
    pub region: String,
    pub country: String,
    pub loc: String,
    pub org: String,
    pub timezone: String,
}

impl IpInfo {
    pub fn location(&self) -> Option<(f64, f64)> {
        let mut parts = self.loc.split(',');
        let lat = parts.next()?.parse::<f64>().ok()?;
        let lon = parts.next()?.parse::<f64>().ok()?;
        Some((lat, lon))
    }
}

impl fmt::Display for IpInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "IP Information:")?;
        writeln!(f, "  IP Address: {}", self.ip)?;
        writeln!(f, "  City: {}", self.city)?;
        writeln!(f, "  Region: {}", self.region)?;
        writeln!(f, "  Country: {}", self.country)?;
        if let Some((lat, lon)) = self.location() {
            writeln!(f, "  Location: Latitude={}, Longitude={}", lat, lon)?;
        }
        writeln!(f, "  Organization: {}", self.org)?;
        writeln!(f, "  Timezone: {}", self.timezone)?;
        Ok(())
    }
}

#[derive(Deserialize, Debug)]
pub struct OpenRouterModelPricing {
    pub prompt: String,
    pub completion: String,
}

#[derive(Deserialize, Debug)]
pub struct OpenRouterModel {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub context_length: Option<u64>,
    pub pricing: Option<OpenRouterModelPricing>,
    pub created: Option<i64>,
}

impl fmt::Display for OpenRouterModel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        writeln!(f, "  ID: {}", self.id)?;
        writeln!(f, "  名称: {}", self.name)?;
        if let Some(desc) = &self.description {
            if !desc.is_empty() {
                writeln!(f, "  描述: {}", desc)?;
            }
        }
        if let Some(ctx) = self.context_length {
            writeln!(f, "  上下文长度: {}", ctx)?;
        }
        if let Some(pricing) = &self.pricing {
            writeln!(f, "  价格(输入): {}/token", pricing.prompt)?;
            writeln!(f, "  价格(输出): {}/token", pricing.completion)?;
        }
        if let Some(created) = self.created {
            let datetime = chrono::DateTime::from_timestamp(created, 0)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S UTC").to_string())
                .unwrap_or_else(|| created.to_string());
            writeln!(f, "  添加时间: {}", datetime)?;
        }
        Ok(())
    }
}

#[derive(Deserialize, Debug)]
pub struct OpenRouterModelsResponse {
    pub data: Vec<OpenRouterModel>,
}

pub async fn fetch_openrouter_models() -> Result<OpenRouterModelsResponse, reqwest::Error> {
    let url = "https://openrouter.ai/api/v1/models";
    tracing::debug!("正在从 {} 获取模型列表", url);

    let response = reqwest::get(url).await?;
    tracing::debug!("收到响应，状态码: {}", response.status());

    let models = response.json::<OpenRouterModelsResponse>().await?;
    tracing::debug!("成功解析模型列表，共 {} 个模型", models.data.len());

    Ok(models)
}

pub async fn fetch_openrouter_model(id: &str) -> Result<Option<OpenRouterModel>, reqwest::Error> {
    let models = fetch_openrouter_models().await?;
    Ok(models.data.into_iter().find(|m| m.id == id))
}

pub async fn fetch_ip_info() -> Result<IpInfo, reqwest::Error> {
    let url = "https://ipinfo.io/json";
    tracing::debug!("正在从 {} 获取 IP 信息", url);

    let response = reqwest::get(url).await?;
    tracing::debug!("收到响应,状态码: {}", response.status());

    let ip_info = response.json::<IpInfo>().await?;
    tracing::debug!("成功解析 IP 信息: {:?}", ip_info);

    Ok(ip_info)
}
