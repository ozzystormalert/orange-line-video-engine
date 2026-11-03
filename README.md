# Orange Line — Independent Engines 3A and 4A

Matches the **Green Line V74** Blogger-to-Render interface: `GET /audit-video?site=Northampton%20Street%20Bridge&state=Pennsylvania&engine=3` and `engine=4`.

1. Create a new GitHub repository (for example `orange-line-video-engine`) and upload `server.js`, `package.json`, and `test.js`.
2. In Render, create **Web Service** connected to that GitHub repository. Runtime **Node**, build command `npm install`, start command `npm start`.
3. In Render environment variables set **YOUTUBE_API_KEY** to your YouTube Data API v3 key; never paste this key into Blogger.
4. Deploy. Confirm `https://YOUR-SERVICE.onrender.com/health` returns `ok:true` and `hasKey:true`.
5. In Orange Line HTML open **About → Video Engines 3A / 4A — Connection**, enter your Render HTTPS base URL, click **SAVE & TEST SERVICE**.
6. Select and **LOCK** Northampton Street Bridge, click **RUN ENGINE 3/4 AUTOMATIC AUDIT**. API titles, view counts, durations, accepted/rejected metadata candidates will display as clickable links.

Engine 3 uses videos **under 4 minutes**, consistent with the Green Line reference. Engine 4 requires **at least 20 minutes**. The search query is the landmark name only. The state is used for disambiguation, not the YouTube query. Neither engine calls a candidate historically **Verified** or assigns an authenticated grade without source-content review.

Run `npm test` for local logic checks. This package does **not** deploy itself. A working external YouTube API key and deployed Render URL are needed for live results.
