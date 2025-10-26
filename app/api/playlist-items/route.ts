// app/api/playlist-items/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getYouTubeClient } from "@/lib/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playlistId = url.searchParams.get("playlistId");
  const pageTokenFromQuery = url.searchParams.get("pageToken") ?? undefined;

  // 控制行為：
  // - all=true|1       -> 強制抓完整清單（忽略 pageToken）
  // - all=false|0      -> 僅抓單頁（可搭配 pageToken）
  // - 未帶 all 且未帶 pageToken -> 預設抓完整清單
  // - 未帶 all 但有 pageToken -> 僅抓單頁
  const allParam = url.searchParams.get("all");
  const forceFetchAll =
    allParam === "1" ||
    allParam?.toLowerCase() === "true" ||
    (!allParam && !pageTokenFromQuery);
  const forceSinglePage =
    allParam === "0" ||
    allParam?.toLowerCase() === "false" ||
    (!!pageTokenFromQuery && allParam !== "1");

  // 可選：限制總抓取數量（避免極大清單）；預設無上限
  const limitParam = url.searchParams.get("limit");
  const hardLimit = limitParam
    ? Math.max(0, Number(limitParam)) || Infinity
    : Infinity;

  if (!playlistId) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "invalid_request", message: "Missing playlistId" },
      },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get("ytpm_session")?.value;
  const userId = raw ? (JSON.parse(raw).userId as string) : null;

  if (!userId) {
    return NextResponse.json({
      items: [],
      nextPageToken: null,
      usingMock: true,
    });
  }

  const yt = await getYouTubeClient(userId);
  if (!yt) {
    return NextResponse.json({
      items: [],
      nextPageToken: null,
      usingMock: true,
    });
  }

  try {
    // 單頁模式（保留原行為）
    if (forceSinglePage && !forceFetchAll) {
      const res = await yt.playlistItems.list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: 50,
        pageToken: pageTokenFromQuery,
      });

      const items = (res.data.items ?? []).map((it) => ({
        id: it.id!, // playlistItemId
        videoId: it.contentDetails?.videoId ?? "",
        title: it.snippet?.title ?? "",
        position:
          typeof it.snippet?.position === "number"
            ? it.snippet!.position!
            : null,
        channelTitle:
          it.snippet?.videoOwnerChannelTitle ?? it.snippet?.channelTitle ?? "",
        thumbnails: it.snippet?.thumbnails ?? null,
        publishedAt:
          it.contentDetails?.videoPublishedAt ??
          it.snippet?.publishedAt ??
          null,
      }));

      return NextResponse.json({
        items,
        nextPageToken: res.data.nextPageToken ?? null,
        usingMock: false,
      });
    }

    // 一次抓完整個播放清單（自動翻頁）
    let nextPageToken: string | undefined = undefined;
    let totalFetched = 0;
    const allItems: Array<{
      id: string;
      videoId: string;
      title: string;
      position: number | null;
      channelTitle: string;
      thumbnails: unknown;
      publishedAt: string | null;
    }> = [];

    // 若 query 已帶 pageToken，但 all=true，則從該 pageToken 起抓到最後
    nextPageToken = pageTokenFromQuery;

    do {
      const res = await yt.playlistItems.list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });

      const batch = (res.data.items ?? []).map((it) => ({
        id: it.id!, // playlistItemId
        videoId: it.contentDetails?.videoId ?? "",
        title: it.snippet?.title ?? "",
        position:
          typeof it.snippet?.position === "number"
            ? it.snippet!.position!
            : null,
        channelTitle:
          it.snippet?.videoOwnerChannelTitle ?? it.snippet?.channelTitle ?? "",
        thumbnails: it.snippet?.thumbnails ?? null,
        publishedAt:
          it.contentDetails?.videoPublishedAt ??
          it.snippet?.publishedAt ??
          null,
      }));

      allItems.push(...batch);
      totalFetched += batch.length;

      // 依 YouTube 回傳決定是否繼續
      nextPageToken = res.data.nextPageToken ?? undefined;

      // 觸達限制就提早結束（避免極端大清單或意外迴圈）
      if (totalFetched >= hardLimit) {
        nextPageToken = undefined;
        break;
      }
    } while (nextPageToken);

    return NextResponse.json({
      items: allItems,
      nextPageToken: null, // 已抓完所有頁
      usingMock: false,
    });
  } catch (err: any) {
    // 友善錯誤回傳，便於前端顯示
    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Failed to fetch playlist items";
    return NextResponse.json(
      { ok: false, error: { code: "youtube_error", message } },
      { status: 500 }
    );
  }
}
