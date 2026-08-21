// app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Playlist Manager",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article className="text-sm leading-relaxed space-y-6">
        <h1 className="text-2xl font-bold mb-8">
          隱私權政策（Privacy Policy）
        </h1>

        <section className="space-y-4">
          <p>
            本頁面說明「Playlist
            Manager」（以下簡稱「本服務」）如何使用與保護您透過 Google OAuth
            所授權的資料。本服務遵守
            <strong> Google API Services User Data Policy </strong>
            ，包含其中的<strong> Limited Use </strong>要求。
          </p>

          <p>
            This Privacy Policy explains how “Playlist Manager” (the
            <strong> Service</strong>) collects, uses, stores, and protects data
            obtained through Google OAuth, in compliance with the
            <strong> Google API Services User Data Policy</strong>, including
            its <strong>Limited Use</strong> requirements.
          </p>
        </section>

        <hr />

        {/* Section 1 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            一、收集與使用的資料類型（Data We Access）
          </h2>

          <h3 className="font-medium">1. Google 帳號基本資料</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>電子郵件地址（email）</li>
            <li>OAuth 使用者識別資訊</li>
          </ul>
          <p>
            用途：此資訊用於建立登入狀態、區分使用者與提供個人化體驗。本服務
            <strong>不會出售、交換或分享</strong>您的資料給任何第三方。
          </p>

          <h3 className="font-medium">2. YouTube 播放清單與影片資料</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>播放清單 ID、名稱、縮圖等必要中繼資料</li>
            <li>影片 ID、標題與排序資訊</li>
          </ul>
          <p>
            用途：在您明確操作時用於播放清單整理（新增／刪除／搬移）。本服務
            <strong>不會讀取與播放清單管理無關的 YouTube 資料</strong>。
          </p>

          <h3 className="font-medium">3. 操作紀錄與日誌（Actions & Logs）</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>操作類型（新增 / 搬移 / 刪除）</li>
            <li>涉及的播放清單與影片 ID</li>
            <li>操作結果 / 錯誤資訊</li>
            <li>執行時間與使用者代碼</li>
          </ul>
          <p>
            用於提供<strong>操作歷史、Undo 回滾、錯誤診斷與濫用防護</strong>。
          </p>
        </section>

        <hr />

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            二、OAuth Token 與安全性（OAuth Tokens & Security）
          </h2>

          <p>授權期間，本服務會以加密方式安全儲存：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access Token</li>
            <li>Refresh Token（若提供）</li>
            <li>Token 到期時間等欄位</li>
          </ul>

          <p>
            Tokens 僅用於呼叫 YouTube Data API，本服務
            <strong>不會將 Token 分享給任何第三方</strong>。
          </p>

          <p>
            您可隨時前往：
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              className="underline ml-1"
            >
              Google 帳戶第三方存取管理
            </a>
            撤銷授權。
          </p>
        </section>

        <hr />

        {/* Section 3 (NEW) */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            三、資料保護機制（Data Protection Measures）
          </h2>

          <h3 className="font-medium">1. 傳輸加密（Encryption in Transit）</h3>
          <p>
            所有本服務與 Google API
            之間、以及使用者瀏覽器與本服務伺服器之間的資料傳輸， 均透過{" "}
            <strong>HTTPS / TLS</strong>{" "}
            加密，防止資料在傳輸過程中被攔截或竄改。
          </p>

          <h3 className="font-medium">2. 儲存加密（Encryption at Rest）</h3>
          <p>
            OAuth Access Token 與 Refresh Token 於資料庫中以
            <strong>加密形式（encrypted at rest）</strong>
            儲存，並與其他系統資料隔離存放，避免未經授權的直接存取。
          </p>

          <h3 className="font-medium">3. 存取控制（Access Control）</h3>
          <p>
            僅本服務內部授權之系統程序可存取儲存的 Token 與使用者資料， 本服務
            <strong>
              不提供任何內部或外部人員直接查詢、匯出使用者 YouTube 資料的介面
            </strong>
            ， 所有資料存取均透過程式化、最小權限（least privilege）之方式進行。
          </p>

          <h3 className="font-medium">4. Limited Use 合規聲明</h3>
          <p>
            本服務對 Google 使用者資料的使用，嚴格遵循
            <strong> Google API Services User Data Policy </strong>
            中的 <strong>Limited Use</strong>{" "}
            要求：僅將取得之資料用於提供、維護本服務中與播放清單管理直接相關之功能，
            不會將資料用於廣告、資料轉售、或訓練一般性 AI／機器學習模型等用途。
          </p>
        </section>

        <hr />

        {/* Section 4 (NEW) */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            四、資料保存與刪除（Data Retention & Deletion）
          </h2>

          <h3 className="font-medium">1. 保存期間（Retention Period）</h3>
          <p>
            Token（Access Token / Refresh Token）於使用者在本服務內
            <strong>主動登出時立即從資料庫中刪除</strong>。
          </p>
          <p>
            若使用者透過 Google 帳戶頁面撤銷授權，該 Token
            會立即失效，本服務將無法再使用該 Token 存取任何 Google 資料。
            該筆失效的 Token
            記錄將保留於資料庫中，直至使用者於本服務內執行登出動作，
            屆時系統會將其永久刪除。
          </p>
          <p>
            播放清單操作紀錄（Action Logs）用於提供操作歷史、Undo
            回滾與錯誤診斷功能，於使用者刪除帳號或提出刪除請求時，將一併移除。
          </p>
          <p className="text-neutral-600">
            Tokens (Access Token / Refresh Token) are permanently deleted from
            our database when the user logs out within the Service. If a user
            revokes access via their Google Account page, the token becomes
            invalid immediately and can no longer be used to access any Google
            data. The invalidated token record remains in our database until the
            user logs out within the Service, at which point it is permanently
            deleted. Playlist action logs, used for undo functionality and error
            diagnostics, are removed upon account deletion or a user's deletion
            request.
          </p>

          <h3 className="font-medium">
            2. 資料刪除請求（Data Deletion Requests）
          </h3>
          <p>使用者可透過以下任一方式，確保其資料被刪除：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>於本服務內點選登出，系統將立即刪除該帳號的 Token 紀錄</li>
            <li>
              來信至 <strong>codylai0217@gmail.com</strong> 提出刪除請求，
              我們將於收到請求後 <strong>7 個工作天內</strong>
              完成所有相關資料（包含 Token 與操作紀錄）的刪除，並回覆確認
            </li>
          </ul>
          <p className="text-neutral-600">
            Users can ensure their data is deleted by either logging out within
            the Service (tokens are deleted immediately), or by emailing{" "}
            <strong>codylai0217@gmail.com</strong> to request deletion. We will
            complete the deletion of all associated data (including tokens and
            action logs) within <strong>7 business days</strong>, with
            confirmation sent via email.
          </p>
        </section>

        <hr />

        {/* Section 5 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            五、不進行的行為（What the Service Does NOT Do）
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>不會出售或分享任何 YouTube Data</li>
            <li>不會在背景執行未經授權之自動行為</li>
            <li>不提供影片下載、重新散佈或鏡像功能</li>
            <li>不代表您執行頻道管理相關操作</li>
          </ul>
        </section>

        <hr />

        {/* Section 6 */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            六、第三方服務（Third-Party Services）
          </h2>
          <p>本服務依賴：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>YouTube Data API v3</li>
            <li>Google OAuth 2.0</li>
          </ul>

          <p>
            使用 Google 服務同時受以下政策約束：
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              className="underline ml-1"
            >
              Google Privacy Policy
            </a>{" "}
            /{" "}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              className="underline"
            >
              Google Terms of Service
            </a>
          </p>
        </section>

        <hr />

        <p className="text-neutral-500 text-xs text-right">
          Last updated: 2025-11-17
        </p>
      </article>
    </main>
  );
}
