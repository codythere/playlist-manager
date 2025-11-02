import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getYouTubeClient } from "@/lib/google";
import { METHOD_COST, recordQuota } from "@/lib/quota";
import { youtube_v3 } from "googleapis";

type PlaylistItemsListResp = Awaited<
  ReturnType<youtube_v3.Resource$Playlistitems["list"]>
>;

function mapYouTubeErrorToHttp(err: any): { status: number; message: string } {
  const msg =
    err?.response?.data?.error?.message ||
    err?.errors?.[0]?.message ||
    err?.message ||
    "YouTube API error";

  const reason =
    err?.response?.data?.error?.errors?.[0]?.reason || err?.errors?.[0]?.reason;

  if (reason === "quotaExceeded" || reason === "rateLimitExceeded") {
    return { status: 429, message: msg };
  }
  if (
    reason === "insufficientPermissions" ||
    reason === "forbidden" ||
    reason === "youtubeSignupRequired"
  ) {
    return { status: 403, message: msg };
  }
  if (reason === "playlistNotFound" || reason === "notFound") {
    return { status: 404, message: msg };
  }
  if (reason === "authError" || reason === "invalidCredentials") {
    return { status: 401, message: msg };
  }
  return { status: 500, message: msg };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playlistId = url.searchParams.get("playlistId");
  const pageTokenFromQuery = url.searchParams.get("pageToken") ?? undefined;

  const allParam = url.searchParams.get("all");
  const forceFetchAll =
    allParam === "1" ||
    allParam?.toLowerCase() === "true" ||
    (!allParam && !pageTokenFromQuery);
  const forceSinglePage =
    allParam === "0" ||
    allParam?.toLowerCase() === "false" ||
    (!!pageTokenFromQuery && allParam !== "1");

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
    if (forceSinglePage && !forceFetchAll) {
      // --- 單頁模式 ---
      const res = await yt.playlistItems.list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: 50,
        pageToken: pageTokenFromQuery,
      });
      recordQuota(
        "playlistItems.list",
        METHOD_COST["playlistItems.list"],
        userId
      ); // ★ 記一筆

      const items = (res.data.items ?? []).map(
        (it: youtube_v3.Schema$PlaylistItem) => ({
          id: it.id!,
          videoId: it.contentDetails?.videoId ?? "",
          title: it.snippet?.title ?? "",
          position:
            typeof it.snippet?.position === "number"
              ? it.snippet.position!
              : null,
          channelTitle:
            it.snippet?.videoOwnerChannelTitle ??
            it.snippet?.channelTitle ??
            "",
          thumbnails: it.snippet?.thumbnails ?? null,
          publishedAt:
            it.contentDetails?.videoPublishedAt ??
            it.snippet?.publishedAt ??
            null,
        })
      );

      return NextResponse.json({
        items,
        nextPageToken: res.data.nextPageToken ?? null,
        usingMock: false,
      });
    }

    let nextPageToken: string | undefined = pageTokenFromQuery;
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

    do {
      const res = await yt.playlistItems.list({
        part: ["snippet", "contentDetails"],
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken,
      });
      recordQuota(
        "playlistItems.list",
        METHOD_COST["playlistItems.list"],
        userId
      ); // ★ 每頁記一筆

      const batch = (res.data.items ?? []).map(
        (it: youtube_v3.Schema$PlaylistItem) => ({
          id: it.id!,
          videoId: it.contentDetails?.videoId ?? "",
          title: it.snippet?.title ?? "",
          position:
            typeof it.snippet?.position === "number"
              ? it.snippet.position!
              : null,
          channelTitle:
            it.snippet?.videoOwnerChannelTitle ??
            it.snippet?.channelTitle ??
            "",
          thumbnails: it.snippet?.thumbnails ?? null,
          publishedAt:
            it.contentDetails?.videoPublishedAt ??
            it.snippet?.publishedAt ??
            null,
        })
      );

      allItems.push(...batch);
      totalFetched += batch.length;
      nextPageToken = res.data.nextPageToken ?? undefined;

      if (totalFetched >= hardLimit) {
        nextPageToken = undefined;
        break;
      }
    } while (nextPageToken);

    return NextResponse.json({
      items: allItems,
      nextPageToken: null,
      usingMock: false,
    });
  } catch (err: any) {
    console.error("[playlist-items] YouTube error:", {
      message: err?.message,
      response: err?.response?.data,
      errors: err?.errors,
    });
    const { status, message } = mapYouTubeErrorToHttp(err);
    return NextResponse.json(
      { ok: false, error: { code: "youtube_error", message } },
      { status }
    );
  }
}
