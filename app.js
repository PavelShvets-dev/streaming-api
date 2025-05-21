const express = require('express');
const fs = require('graceful-fs');
const cors = require('cors');
const app = express();

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

// Video streaming endpoint
app.get('/video', (req, res) => {
    const filePath = `/opt/media/${req.query.id}`;
    console.log(`Streaming video: ${filePath}`);

    fs.stat(filePath, (err, stat) => {
        if (err) {
            console.error("File error:", err);
            return res.sendStatus(err.code === 'ENOENT' ? 404 : 500);
        }

        const fileSize = stat.size;
        const range = req.headers.range;

        // Headers for all responses
        res.setHeader("Content-Type", "video/mp4");
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