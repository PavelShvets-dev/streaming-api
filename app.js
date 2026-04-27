const express = require('express');
const fs = require('graceful-fs');
const path = require('path');
const cors = require('cors');
const app = express();

/** iOS AVPlayer is strict about Content-Type; do not send video/mp4 for .mp3. */
function contentTypeForMediaPath(filePath) {
    const ext = path.extname(filePath || '').toLowerCase();
    switch (ext) {
        case '.mp3':
            return 'audio/mpeg';
        case '.m4a':
            return 'audio/mp4';
        case '.wav':
            return 'audio/wav';
        case '.aac':
            return 'audio/aac';
        case '.mp4':
        case '.m4v':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.mov':
            return 'video/quicktime';
        case '.m3u8':
            return 'application/vnd.apple.mpegurl';
        default:
            return 'application/octet-stream';
    }
}

// CORS configuration
const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.static("public"));

app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No Content
});

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Video / audio streaming (id = path relative to /opt/media)
app.get('/video', (req, res) => {
    const filePath = `/opt/media/${req.query.id}`;
    const contentType = contentTypeForMediaPath(filePath);
    console.log(`Streaming media: ${filePath} (${contentType})`);

    fs.stat(filePath, (err, stat) => {
        if (err) {
            console.error("File error:", err);
            return res.sendStatus(err.code === 'ENOENT' ? 404 : 500);
        }

        const fileSize = stat.size;
        const range = req.headers.range;

        // Headers for all responses
        res.setHeader("Content-Type", contentType);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "no-cache");

        // Handle HEAD requests (for preflight checks)
        if (req.method === "HEAD") {
            res.setHeader("Content-Length", fileSize);
            return res.status(200).end();
        }

        // Parse range headers (for seeking)
        let start = 0;
        let end = fileSize - 1;

        if (range) {
            const bytesPrefix = "bytes=";
            if (range.startsWith(bytesPrefix)) {
                const bytesRange = range.substring(bytesPrefix.length);
                const parts = bytesRange.split("-");
                start = parseInt(parts[0], 10);
                end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            }
        }

        // Calculate chunk size
        const contentLength = end - start + 1;

        // Set headers for partial/full content
        if (range) {
            res.status(206); // Partial Content
            res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        } else {
            res.status(200); // Full Content
        }

        res.setHeader("Content-Length", contentLength);

        // Stream the video
        const stream = fs.createReadStream(filePath, { start, end });
        stream.on("error", (err) => {
            console.error("Stream error:", err);
            if (!res.headersSent) res.sendStatus(500);
        });
        stream.pipe(res);
    });
});

app.listen(3000, () => {
    console.log("Server running 3000");
});