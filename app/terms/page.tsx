// app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | Playlist Manager",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article className="text-sm leading-relaxed space-y-6">
        <h1 className="text-2xl font-bold mb-8">使用條款（Terms of Use）</h1>

        {/* Intro */}
        <section className="space-y-4">
          <p>
            歡迎使用「Playlist
            Manager」（以下簡稱「本服務」）。請在使用本服務前詳細閱讀本使用條款。當您登入並使用本服務時，即表示您已閱讀、理解並同意受本條款的約束。
          </p>

          <p>
            By accessing or using <strong>“Playlist Manager”</strong> (the{" "}
            <strong>Service</strong>), you agree to be bound by these Terms of
            Use. If you do not agree to these terms, please do not use the
            Service.
          </p>
        </section>

        <hr />

        {/* 1. Nature of Service */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            一、服務性質（Nature of the Service）
          </h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              本服務為個人開發的實驗性 Web
              應用程式，旨在協助使用者更有效率地管理其 YouTube
              播放清單（例如批次搬移、刪除與整理）。
            </li>
            <li>
              本服務與 Google LLC、YouTube
              或任何關係企業並無任何隸屬、合作、代理或授權關係。
            </li>
          </ul>

          <p>
            The Service is an experimental web application built by an
            independent developer. It helps users manage their YouTube playlists
            through bulk operations. It is{" "}
            <strong>not affiliated with, endorsed by, or sponsored by</strong>{" "}
            Google LLC or YouTube.
          </p>
        </section>

        <hr />

        {/* 2. Accounts & Authorization */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            二、帳號與授權（Accounts & Authorization）
          </h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              您必須透過 Google OAuth
              登入後方可使用本服務。本服務僅在您授權範圍內存取與播放清單管理相關的
              YouTube 資料。
            </li>
            <li>
              您可隨時於 Google
              帳戶管理頁面撤銷本服務的存取權，撤銷後，本服務將無法再存取您的
              YouTube 資料或代表您執行任何操作。
            </li>
            <li>
              您有責任妥善保管個人 Google
              帳號與登入憑證，不得將登入權限提供、出借或轉讓予任何第三人使用。
            </li>
          </ul>
        </section>

        <hr />

        {/* 3. Acceptable Use */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            三、使用規範（Acceptable Use）
          </h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              您同意僅在遵守 YouTube
              服務條款、社群規範與適用法令的前提下使用本服務，不得利用本服務進行任何違法、侵權、騷擾或不當行為。
            </li>
            <li>
              您不得嘗試繞過 Google 或 YouTube
              的安全機制、配額限制或其他技術性保護措施。
            </li>
            <li>
              您不得以自動化方式或批量濫用方式發送過量請求，造成 YouTube API
              或本服務伺服器過載或服務品質下降。
            </li>
            <li>
              本服務不提供影片或音訊內容下載功能，您不得透過本服務嘗試取得未被授權的內容副本或迴避
              YouTube 的下載限制。
            </li>
          </ul>
        </section>

        <hr />

        {/* 4. Bulk Operations & Risks */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            四、批次操作與風險告知（Bulk Operations & Risks）
          </h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              本服務提供批次搬移、刪除與整理等操作，所有動作均需由您在介面中手動點擊並二次確認後才會執行。
            </li>
            <li>
              一旦您確認執行操作，對應的播放清單與影片排列即可能在 YouTube
              上產生不可逆的變更（除非本服務明確提供 Undo
              功能且該操作在可回滾範圍內）。
            </li>
            <li>
              本服務雖可能提供
              Undo／回滾機制，但不保證所有情況皆可成功或完全復原，您應在執行前仔細檢查操作目標與範圍。
            </li>
            <li>
              因網路異常、API
              回應錯誤、配額限制或其他不可抗力因素導致的操作中斷、失敗或延遲，本服務與開發者不負任何賠償責任。
            </li>
          </ul>
        </section>

        <hr />

        {/* 5. Quota & Service Interruption */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            五、配額與服務中斷（Quota & Service Interruption）
          </h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              本服務依賴 YouTube Data API v3，受限於 Google
              所提供的配額與速率限制。當配額用盡或 API 回傳{" "}
              <code>quotaExceeded</code>{" "}
              等錯誤時，本服務部分或全部功能可能暫時無法使用。
            </li>
            <li>
              開發者保留調整、限制或暫停批次操作功能的權利，以避免配額耗盡、濫用或影響其他使用者。
            </li>
            <li>
              因配額限制、第三方服務異常、維護或升級造成的服務中斷、功能受限或資料更新延遲，本服務不負任何賠償或補償責任。
            </li>
          </ul>
        </section>

        <hr />

        {/* 6. Disclaimer */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">六、免責聲明（Disclaimer）</h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              本服務係以「現狀」（as-is）提供，不保證功能完全正確、不中斷、無錯誤，亦不保證能滿足您的所有使用需求或特定目的。
            </li>
            <li>
              對於因使用或無法使用本服務所導致的任何直接、間接、附帶、特別或衍生性損害（包含但不限於資料遺失、商業損失或收益減少），開發者不承擔任何責任。
            </li>
            <li>
              您了解並同意，任何透過 YouTube Data API
              或第三方服務所進行的操作，均可能受到該等服務本身之限制、錯誤或中斷之影響。
            </li>
          </ul>
        </section>

        <hr />

        {/* 7. Intellectual Property */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            七、智慧財產權（Intellectual Property）
          </h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              本服務的程式碼、介面設計及相關資產（除另有標示外），均為開發者或其授權人之智慧財產。
            </li>
            <li>
              「YouTube」及相關標誌為 Google LLC
              之註冊商標或商標，本服務僅為技術相容之第三方工具，與前述權利人無關。
            </li>
          </ul>
        </section>

        <hr />

        {/* 8. Changes to Terms */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            八、條款修改（Changes to These Terms）
          </h2>

          <p>
            開發者得視情況隨時修改本使用條款，更新後的內容將公佈於本頁面。建議您定期查閱最新版本；若您在條款更新後持續使用本服務，即視為您已同意修改後之內容。
          </p>

          <p>
            The developer may update these Terms of Use from time to time. Your
            continued use of the Service after any changes indicates your
            acceptance of the updated terms.
          </p>
        </section>

        <hr />

        {/* 9. Contact */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">九、聯繫方式（Contact）</h2>

          <p>若您對本服務或本條款有任何疑問，歡迎透過以下方式聯繫：</p>

          <ul className="list-disc pl-6 space-y-2">
            <li>
              Email：<strong>codylai0217@gmail.com</strong>{" "}
            </li>
          </ul>

          <hr />

          <p className="text-neutral-500 text-xs text-right">
            Last updated: 2025-11-17
          </p>
        </section>
      </article>
    </main>
  );
}
