import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getYouTubeClient } from "@/lib/google";
import { METHOD_COST, runWithQuota, recordQuota } from "@/lib/quota";
import { youtube_v3 } from "googleapis";

type PlaylistsListResp = Awaited<
  ReturnType<youtube_v3.Resource$Playlists["list"]>
>;

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("ytpm_session")?.value;
  const userId = raw ? (JSON.parse(raw).userId as string) : null;

  if (!userId) {
    return NextResponse.json({
      playlists: [],
      estimatedQuota: 0,
      usingMock: true,
    });
  }

  const yt = await getYouTubeClient(userId);
  if (!yt) {
    return NextResponse.json({
      playlists: [],
      estimatedQuota: 0,
      usingMock: true,
    });
  }

  try {
    const all: Array<{
      id: string;
      title: string;
      channelTitle: string;
      itemCount: number;
      thumbnails: unknown;
      thumbnailUrl: string | null;
      publishedAt: string | null;
    }> = [];

    let nextPageToken: string | undefined = undefined;
    let pages = 0;

    do {
      const res = await runWithQuota(
        "playlists.list",
        METHOD_COST["playlists.list"],
        () =>
          yt.playlists.list({
            part: ["snippet", "contentDetails"],
            mine: true,
            maxResults: 50,
            pageToken: nextPageToken,
          })
      );

      const batch =
        (res.data.items ?? []).map((p: youtube_v3.Schema$Playlist) => ({
          id: p.id!,
          title: p.snippet?.title ?? "",
          channelTitle: p.snippet?.channelTitle ?? "",
          itemCount: p.contentDetails?.itemCount ?? 0,
          thumbnails: p.snippet?.thumbnails ?? null,
          thumbnailUrl:
            p.snippet?.thumbnails?.medium?.url ??
            p.snippet?.thumbnails?.high?.url ??
            p.snippet?.thumbnails?.default?.url ??
            null,
          publishedAt: p.snippet?.publishedAt ?? null,
        })) ?? [];

      all.push(...batch);
      pages += 1;
      nextPageToken = res.data.nextPageToken ?? undefined;
    } while (nextPageToken);

    recordQuota(
      "playlists.list",
      pages * METHOD_COST["playlists.list"],
      userId
    );

    return NextResponse.json({
      playlists: all,
      estimatedQuota: pages * METHOD_COST["playlists.list"],
      usingMock: false,
    });
  } catch (err: any) {
    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Failed to fetch playlists";
    return NextResponse.json(
      { ok: false, error: { code: "youtube_error", message } },
      { status: 500 }
    );
  }
}
