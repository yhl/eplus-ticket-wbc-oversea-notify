// Node.js 版本的 eplus 門票監控通知腳本
// 功能：定期檢查指定 eplus 頁面是否有可購票按鈕，若有則透過 LINE Push Message 通知
// 所需套件：axios（抓網頁）、cheerio（解析 HTML）、node-cron（可選，定時執行）

// 安裝依賴（第一次執行前在終端機跑一次）
// npm init -y
// npm install axios cheerio node-cron

const axios = require("axios")
const cheerio = require("cheerio")
const cron = require("node-cron")

// ==================== 設定區 ====================
const CONFIG = {
  CHANNEL_ACCESS_TOKEN: "_CHANNEL_ACCESS_TOKEN_", // LINE Messaging API 的 Channel Access Token
  USER_ID: "_USER_ID_", // 你的 LINE User ID (U開頭)
  TARGET_URL: "https://eplus.tickets/en/sf/ibt/detail/0260360001-P0030081P0030082P0030083P0030084P0030085P0030086P0030087P0030088P0030089P0030090?P6=i00", // eplus 海外站 wbc 售票網址
  CHECK_INTERVAL: "*/5 * * * *", // cron 格式，每 5 分鐘檢查一次（可自行調整）
}

// ==================== 主函式 ====================
async function checkTickets() {
  console.log(`[${new Date().toLocaleString()}] 開始檢查門票...`)

  try {
    // 1. 抓取網頁（模擬瀏覽器 User-Agent，避免被簡單阻擋）
    const response = await axios.get(CONFIG.TARGET_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0 Herring/90.1.1640.8",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 15000, // 15 秒超時
    })

    if (response.status !== 200) {
      console.error(`網頁請求失敗，狀態碼: ${response.status}`)
      return
    }

    // 2. 使用 Cheerio 解析 HTML（比 regex 更穩定可靠）
    const $ = cheerio.load(response.data)
    const article = $("article")
    // 3. 構建訊息
    let messageBody = "🎫 **eplus wbc C組各日賽事售票狀態列表通知**\n\n"
    messageBody += `須強調，即便狀態顯示為 Now Available，仍以實際有釋出可販售區域為準\n\n`

    article.each((index, element) => {
      const articleAllSection = $(element)
      const articleContent = articleAllSection.find(".block-ticket-article__content")

      articleContent.each((i, e) => {
        articleContentDetail = $(e)
        // const blockTicket = b.find(".block-ticket")
        const ticketBlocks = articleContentDetail.find(".block-ticket:not(.hidden)")
        const ticketButtons = ticketBlocks.find("button.button.button--primary")

        if (ticketButtons.length === 0) {
          //   console.log("目前沒有可購票項目（無 button--primary）")
          return
        }
        // 提取所需資訊（根據目前 eplus 頁面結構調整 selector）
        const articleTitle = articleAllSection.find(".block-ticket-article__title").text().trim() || "未知賽事"
        const date = articleAllSection.find(".block-ticket-article__date").text().trim() || "未知日期"
        // const ticketTitle = b.find(".block-ticket:not(.hidden)").find(".block-ticket__title").text().trim() || "未知票種"
        messageBody += `-------------
#${i + 1}
⚾ 賽事: ${articleTitle}
📅 日期: ${date}\n`
      })
    })

    messageBody += `\n🔗 購票連結:\n${CONFIG.TARGET_URL}`

    // 4. 發送 LINE Push Message
    console.log(messageBody)
    await sendLineMessage(messageBody)
  } catch (error) {
    console.error("執行過程中發生錯誤:", error.message)
    // 可選：錯誤時也發送 LINE 通知，避免完全沉默
    // await sendLineMessage(`⚠️ 門票檢查程式發生錯誤:\n${error.message}`);
  }
}

// ==================== LINE 發送函式 ====================
async function sendLineMessage(text) {
  const url = "https://api.line.me/v2/bot/message/push"

  const payload = {
    to: CONFIG.USER_ID,
    messages: [
      {
        type: "text",
        text: text,
      },
    ],
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.CHANNEL_ACCESS_TOKEN}`,
      },
    })

    if (response.status === 200) {
      console.log("LINE 通知發送成功")
    } else {
      console.error("LINE 發送失敗:", response.data)
    }
  } catch (error) {
    console.error("LINE 發送錯誤:", error.response?.data || error.message)
  }
}

// ==================== 啟動 ====================
// 手動執行一次：node your_script.js
// 或使用 cron 定時執行
cron.schedule(CONFIG.CHECK_INTERVAL, () => {
  checkTickets()
})

// 如果不要定時執行，可直接寫 checkTickets()

console.log("門票監控腳本已啟動，檢查間隔:", CONFIG.CHECK_INTERVAL)
// 啟動後會持續運行，按 Ctrl+C 停止
