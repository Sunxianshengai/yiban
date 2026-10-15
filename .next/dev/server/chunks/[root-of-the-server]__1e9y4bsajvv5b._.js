module.exports = [
(()=>{"use strict";return[
"[project]/app/api/[...path]/route.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "PATCH",
    ()=>PATCH,
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs/promises [external] (node:fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/store.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$core$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/core.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ai$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/ai.mjs [app-route] (ecmascript)");
;
;
;
;
;
;
;
const runtime = 'nodejs';
const dynamic = 'force-dynamic';
const json = (data, status = 200)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(data, {
        status
    });
const bad = (e, status = 400)=>json({
        error: e.message || '请求未能完成'
    }, status);
const allowed = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
    'video/mp4': '.mp4',
    'video/webm': '.webm'
};
async function GET(request, { params }) {
    const { path: parts } = await params;
    try {
        if (parts[0] === 'state') return json((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["snapshot"])());
        if (parts[0] === 'search') {
            const q = new URL(request.url).searchParams.get('q');
            return json({
                memories: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$core$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["searchMemories"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["all"])('memories').filter((m)=>m.status === 'confirmed'), q),
                mode: 'keyword'
            });
        }
        if (parts[0] === 'media') {
            const file = parts[1] || '';
            if (!/^[a-f0-9-]+\.(jpg|png|webp|mp3|wav|m4a|ogg|webm|mp4)$/.test(file)) return json({
                error: '无效文件名'
            }, 404);
            const data = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["readFile"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data', 'uploads', file));
            const ext = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].extname(file);
            const types = {
                '.jpg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.m4a': 'audio/mp4',
                '.ogg': 'audio/ogg',
                '.webm': 'video/webm',
                '.mp4': 'video/mp4'
            };
            const headers = {
                'Content-Type': types[ext],
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'private, max-age=3600',
                'Accept-Ranges': 'bytes'
            };
            const range = request.headers.get('range');
            if (range) {
                const match = /^bytes=(\d+)-(\d*)$/.exec(range);
                if (!match) return new Response(null, {
                    status: 416,
                    headers: {
                        'Content-Range': `bytes */${data.length}`
                    }
                });
                const start = Number(match[1]), end = match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
                if (start > end || start >= data.length) return new Response(null, {
                    status: 416,
                    headers: {
                        'Content-Range': `bytes */${data.length}`
                    }
                });
                return new Response(data.subarray(start, end + 1), {
                    status: 206,
                    headers: {
                        ...headers,
                        'Content-Range': `bytes ${start}-${end}/${data.length}`,
                        'Content-Length': String(end - start + 1)
                    }
                });
            }
            return new Response(data, {
                headers: {
                    ...headers,
                    'Content-Length': String(data.length)
                }
            });
        }
        return json({
            error: '页面不存在'
        }, 404);
    } catch (e) {
        return bad(e, parts[0] === 'media' ? 404 : 500);
    }
}
async function POST(request, { params }) {
    const { path: parts } = await params;
    try {
        if (parts[0] === 'upload') {
            const contentLength = Number(request.headers.get('content-length') || 0);
            if (contentLength > 52 * 1024 * 1024) throw new Error('文件不能超过 50 MB');
            const form = await request.formData();
            const file = form.get('file');
            if (!file || typeof file === 'string' || !file.size) throw new Error('请选择一个文件');
            const extension = allowed[file.type];
            if (!extension) throw new Error('支持 JPG / PNG / WebP 图片，MP3 / WAV / M4A / OGG / WebM 音频和 MP4 / WebM 视频');
            if (file.size > 50 * 1024 * 1024) throw new Error('文件不能超过 50 MB');
            const dir = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data', 'uploads');
            await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["mkdir"])(dir, {
                recursive: true
            });
            const name = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])() + extension;
            await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["writeFile"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dir, name), Buffer.from(await file.arrayBuffer()));
            return json({
                url: `/api/media/${name}`,
                type: file.type,
                name: file.name
            });
        }
        const body = await request.json();
        if (parts[0] === 'comments') {
            const memory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('memories', body.memoryId);
            if (!memory) throw new Error('记忆不存在');
            const comment = String(body.text || '').trim().slice(0, 1000);
            if (!comment) throw new Error('请输入留言');
            const activity = {
                id: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
                type: 'comment',
                text: `给「${memory.title}」留下了留言`,
                comment,
                memoryId: memory.id,
                createdAt: new Date().toISOString()
            };
            return json((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('activity', activity), 201);
        }
        if (parts[0] === 'memories') {
            const memory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$core$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["tidyMemory"])(body);
            for (const key of [
                'cover',
                'audio',
                'video'
            ])if (body[key]) {
                if (!/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/.test(body[key])) throw new Error('素材地址不合法');
                memory[key] = body[key];
            }
            if (memory.cover) memory.assetType = 'photo';
            memory.id = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])();
            memory.createdAt = new Date().toISOString();
            memory.updatedAt = memory.createdAt;
            memory.isDemo = false;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('memories', memory);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["log"])('created', `添加了记忆「${memory.title}」`, memory.id);
            return json(memory, 201);
        }
        if (parts[0] === 'organize') {
            let imageData = null;
            if (body.cover && /^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp)$/.test(body.cover) && process.env.AI_API_KEY) {
                const data = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["readFile"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data', 'uploads', __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].basename(body.cover)));
                if (data.length > 8 * 1024 * 1024) throw new Error('模型整理使用的图片请控制在 8 MB 以内');
                const ext = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].extname(body.cover);
                imageData = `data:${ext === '.jpg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : 'image/webp'};base64,${data.toString('base64')}`;
            }
            return json(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ai$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["organize"])(body, imageData));
        }
        if (parts[0] === 'albums') {
            const title = String(body.title || '').trim().slice(0, 80);
            if (!title) throw new Error('请填写专辑名称');
            const ids = [
                ...new Set(body.memoryIds || [])
            ].filter((id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('memories', id)?.status === 'confirmed');
            if (!ids.length) throw new Error('请至少选择一段已确认的记忆');
            const album = {
                id: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
                title,
                description: String(body.description || '').slice(0, 200),
                memoryIds: ids,
                cover: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('memories', ids[0]).cover,
                story: '',
                createdAt: new Date().toISOString()
            };
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('albums', album);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["log"])('album', `创建了专辑「${title}」`);
            return json(album, 201);
        }
        if (parts[0] === 'story') {
            const album = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('albums', body.albumId);
            if (!album) throw new Error('专辑不存在');
            const memories = album.memoryIds.map((id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('memories', id)).filter((m)=>m?.status === 'confirmed');
            if (!memories.length) throw new Error('这张专辑还没有已确认的记忆');
            return json(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$ai$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["generateStory"])(memories, album.title));
        }
        if (parts[0] === 'activity') {
            const types = {
                play: '播放',
                remember: '点击了「我记得」',
                like: '点击了「喜欢」',
                replay: '点击了「再听一次」',
                pause: '暂停了播放'
            };
            if (!types[body.type]) throw new Error('不支持的互动类型');
            const memory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('memories', body.memoryId);
            if (!memory || memory.status !== 'confirmed') throw new Error('记忆不可播放');
            return json((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["log"])(body.type, `${types[body.type]}「${memory.title}」`, memory.id));
        }
        if (parts[0] === 'members') {
            const name = String(body.name || '').trim().slice(0, 30);
            if (!name) throw new Error('请填写成员姓名');
            const member = {
                id: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
                name,
                relation: String(body.relation || '家人').slice(0, 30),
                role: '家庭成员',
                color: 'sage'
            };
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('members', member);
            return json(member, 201);
        }
        if (parts[0] === 'anniversaries') {
            const title = String(body.title || '').trim().slice(0, 80);
            const date = String(body.date || '');
            if (!title || !/^\d{2}-\d{2}$/.test(date)) throw new Error('请填写名称并选择日期');
            const [month, day] = date.split('-').map(Number);
            const d = new Date(2024, month - 1, day);
            if (d.getMonth() !== month - 1 || d.getDate() !== day) throw new Error('日期不合法');
            return json((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('anniversaries', {
                id: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
                title,
                date,
                memoryIds: []
            }));
        }
        return json({
            error: '接口不存在'
        }, 404);
    } catch (e) {
        return bad(e);
    }
}
async function PATCH(request, { params }) {
    const { path: parts } = await params;
    try {
        const body = await request.json();
        if (parts[0] === 'memories') {
            const old = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('memories', parts[1]);
            if (!old) return json({
                error: '记忆不存在'
            }, 404);
            const updated = {
                ...old,
                ...(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$core$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["tidyMemory"])(body, old),
                updatedAt: new Date().toISOString()
            };
            for (const key of [
                'cover',
                'audio',
                'video'
            ])if (body[key] && body[key] !== old[key]) {
                if (!/^\/api\/media\/[a-f0-9-]+\.[a-z0-9]+$/.test(body[key])) throw new Error('素材地址不合法');
                updated[key] = body[key];
            }
            if (updated.cover?.startsWith('/api/media/')) updated.assetType = 'photo';
            if (body.clearAudio) updated.audio = null;
            if (body.clearVideo) updated.video = null;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('memories', updated);
            return json(updated);
        }
        if (parts[0] === 'settings') {
            const old = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('settings', 'family');
            const update = {
                ...old,
                familyName: String(body.familyName ?? old.familyName).trim().slice(0, 60) || old.familyName,
                elderName: String(body.elderName ?? old.elderName).trim().slice(0, 30) || old.elderName,
                fontSize: [
                    'large',
                    'extra'
                ].includes(body.fontSize) ? body.fontSize : old.fontSize,
                highContrast: Boolean(body.highContrast ?? old.highContrast),
                autoPlay: Boolean(body.autoPlay ?? old.autoPlay),
                speechRate: Math.min(1.2, Math.max(0.5, Number(body.speechRate ?? old.speechRate) || 0.85))
            };
            return json((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('settings', update));
        }
        if (parts[0] === 'albums') {
            const old = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('albums', parts[1]);
            if (!old) throw new Error('专辑不存在');
            return json((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('albums', {
                ...old,
                story: String(body.story ?? old.story).slice(0, 10000)
            }));
        }
        return json({
            error: '接口不存在'
        }, 404);
    } catch (e) {
        return bad(e);
    }
}
async function DELETE(request, { params }) {
    const { path: parts } = await params;
    try {
        if (![
            'memories',
            'albums',
            'members',
            'anniversaries'
        ].includes(parts[0])) return json({
            error: '接口不存在'
        }, 404);
        const old = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])(parts[0], parts[1]);
        if (!old) return json({
            error: '内容不存在'
        }, 404);
        if (parts[0] === 'members' && old.role === '管理员') throw new Error('比赛版请保留管理员');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["remove"])(parts[0], parts[1]);
        if (parts[0] === 'memories') {
            for (const album of (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["all"])('albums'))if (album.memoryIds.includes(old.id)) {
                const ids = album.memoryIds.filter((id)=>id !== old.id);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])('albums', {
                    ...album,
                    memoryIds: ids,
                    cover: ids.length ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["get"])('memories', ids[0])?.cover : null,
                    story: ''
                });
            }
            for (const key of [
                'cover',
                'audio',
                'video'
            ])if (old[key]?.startsWith('/api/media/')) await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs$2f$promises__$5b$external$5d$__$28$node$3a$fs$2f$promises$2c$__cjs$29$__["unlink"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data', 'uploads', __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].basename(old[key]))).catch(()=>{});
            for (const record of (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["all"])('activity'))if (record.memoryId === old.id) (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$store$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["remove"])('activity', record.id);
        }
        return json({
            ok: true
        });
    } catch (e) {
        return bad(e);
    }
}
}),
"[project]/lib/ai.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "generateStory",
    ()=>generateStory,
    "organize",
    ()=>organize
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$core$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/core.mjs [app-route] (ecmascript)");
;
const enabled = ()=>Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL);
async function callModel(messages) {
    const url = new URL(process.env.AI_API_URL);
    if (![
        'https:',
        'http:'
    ].includes(url.protocol)) throw new Error('模型接口地址需要使用 HTTP 或 HTTPS');
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.AI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.AI_MODEL,
            messages,
            temperature: 0.3
        }),
        signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error(`模型服务返回 ${response.status}，请检查本机配置和服务额度`);
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('模型返回内容格式不兼容');
    return content;
}
async function organize(input, imageData = null) {
    if (!enabled()) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$core$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["localOrganize"])(input);
    const content = [
        {
            type: 'text',
            text: `请整理这段家庭记忆，仅用提供的事实。照片只能描述可见场景，不可猜测人物身份、年份和关系。保留用户已填的人物/日期。输出纯JSON：title,story,year,location,people数组,theme（家人/老家/旅行/青春/节日/日常）,tags数组。不确定的字段留空。输入：${JSON.stringify(input)}`
        }
    ];
    if (imageData) content.push({
        type: 'image_url',
        image_url: {
            url: imageData
        }
    });
    const text = await callModel([
        {
            role: 'system',
            content: '你是家庭记忆整理助手。不得编造家庭经历。输出必须由家属核对。'
        },
        {
            role: 'user',
            content
        }
    ]);
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let result;
    try {
        result = JSON.parse(clean);
    } catch  {
        throw new Error('模型没有返回有效的结构化内容，请重试或手动整理');
    }
    return {
        ...result,
        mode: 'model',
        note: '模型整理结果，请核对人物、时间和故事事实后再发布。'
    };
}
async function generateStory(memories, title) {
    if (!enabled()) return {
        story: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$core$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["storyFromMemories"])(memories, title),
        mode: 'local'
    };
    const story = await callModel([
        {
            role: 'system',
            content: '你是家庭故事编辑。将已确认的记忆串联成温柔、短句的讲述。只能使用提供的事实，不能增加对话、关系、地点或事件。最多600字。'
        },
        {
            role: 'user',
            content: JSON.stringify({
                title,
                memories: memories.map((m)=>({
                        title: m.title,
                        year: m.year,
                        location: m.location,
                        people: m.people,
                        story: m.story
                    }))
            })
        }
    ]);
    return {
        story,
        mode: 'model'
    };
}
}),
"[project]/lib/core.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "THEMES",
    ()=>THEMES,
    "localOrganize",
    ()=>localOrganize,
    "searchMemories",
    ()=>searchMemories,
    "storyFromMemories",
    ()=>storyFromMemories,
    "tidyMemory",
    ()=>tidyMemory
]);
const THEMES = [
    '家人',
    '老家',
    '旅行',
    '青春',
    '节日',
    '日常'
];
function tidyMemory(input, previous = {}) {
    const text = (v, max = 200)=>String(v ?? '').trim().slice(0, max);
    const list = (v)=>(Array.isArray(v) ? v : String(v || '').split(/[,，、]/)).map((x)=>text(x, 30)).filter(Boolean).slice(0, 15);
    const year = text(input.year ?? previous.year, 12);
    if (year && !/^\d{4}(?:年|年代)?$/.test(year)) throw new Error('年代请填写四位年份，例如 1995');
    const title = text(input.title ?? previous.title, 80);
    if (!title) throw new Error('请给这段记忆起一个名字');
    return {
        title,
        year,
        location: text(input.location ?? previous.location, 80),
        people: list(input.people ?? previous.people),
        tags: list(input.tags ?? previous.tags),
        theme: THEMES.includes(input.theme ?? previous.theme) ? input.theme ?? previous.theme : '家人',
        story: text(input.story ?? previous.story, 6000),
        status: (input.status ?? previous.status) === 'confirmed' ? 'confirmed' : 'draft',
        favorite: Boolean(input.favorite ?? previous.favorite),
        cover: previous.cover || null,
        audio: previous.audio || null,
        video: previous.video || null,
        assetType: previous.assetType || 'illustration'
    };
}
function searchMemories(memories, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return memories;
    const raw = q.replace(/(我想|想要|想|看看|看一下|找一下|找找|给我|有没有|的照片|照片|的故事|故事|播放|回忆|一下|记忆|请|还有|吗|呢)/g, ' ').trim();
    const aliases = {
        '女儿': [
            '小雨'
        ],
        '妈妈': [
            '林阿姨'
        ],
        '母亲': [
            '林阿姨'
        ],
        '爸爸': [
            '陈叔叔'
        ],
        '父亲': [
            '陈叔叔'
        ],
        '旅游': [
            '旅行'
        ],
        '过年': [
            '节日',
            '春节'
        ],
        '年轻': [
            '青春'
        ],
        '小时候': [
            '童年'
        ],
        '故乡': [
            '老家'
        ]
    };
    const terms = [
        ...new Set([
            raw,
            ...raw.split(/\s+/),
            ...Object.entries(aliases).filter(([key])=>q.includes(key)).flatMap(([, v])=>v)
        ].filter(Boolean))
    ];
    if (!terms.length) return [];
    return memories.map((m)=>{
        const haystack = [
            m.title,
            m.story,
            m.location,
            m.year,
            m.theme,
            ...m.people,
            ...m.tags
        ].join(' ').toLowerCase();
        const score = terms.reduce((sum, term)=>sum + (haystack.includes(term) ? 1 : 0), 0);
        return {
            m,
            score
        };
    }).filter((x)=>x.score).sort((a, b)=>b.score - a.score).map((x)=>x.m);
}
function localOrganize(input) {
    const story = String(input.story || '').trim();
    const text = `${input.title || ''} ${story} ${input.location || ''}`;
    const rules = {
        家人: [
            '家人',
            '女儿',
            '儿子',
            '妈妈',
            '爸爸',
            '婚礼',
            '全家'
        ],
        老家: [
            '老家',
            '故乡',
            '院子',
            '家乡'
        ],
        旅行: [
            '旅行',
            '旅游',
            '杭州',
            '西湖',
            '火车'
        ],
        青春: [
            '毕业',
            '学校',
            '青春',
            '大学',
            '年轻'
        ],
        节日: [
            '春节',
            '过年',
            '中秋',
            '生日',
            '团圆'
        ],
        日常: [
            '做饭',
            '菜',
            '散步',
            '花',
            '日常'
        ]
    };
    const detected = Object.entries(rules).filter(([, words])=>words.some((w)=>text.includes(w))).map(([theme])=>theme);
    const yearMatch = text.match(/(?:19|20)\d{2}/);
    return {
        title: String(input.title || '一段家庭记忆'),
        story: story || '请补充这张照片背后的故事：当时有哪些家人、在哪里、发生了什么？',
        year: input.year || yearMatch?.[0] || '',
        location: input.location || '',
        people: Array.isArray(input.people) ? input.people : String(input.people || '').split(/[,，、]/).filter(Boolean),
        theme: detected[0] || input.theme || '家人',
        tags: [
            ...new Set([
                ...input.tags || [],
                ...detected
            ])
        ].slice(0, 12),
        mode: 'local',
        note: '本地整理依据你填写的文字提取标签和年份，不会识别照片人物，也不会推测家庭事实。'
    };
}
function storyFromMemories(memories, title) {
    const fragments = memories.map((m)=>`${m.year ? m.year + '年，' : ''}${m.location ? '在' + m.location + '，' : ''}${m.story || m.title}`);
    return `《${title}》\n\n${fragments.join('\n\n')}\n\n这些由家人保存的片段，组成了我们共同的记忆。`;
}
}),
"[project]/lib/seed.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "seedAlbums",
    ()=>seedAlbums,
    "seedMemories",
    ()=>seedMemories
]);
const seedMemories = [
    {
        id: 'demo-westlake',
        title: '那年，我们一起去西湖',
        year: '1995',
        location: '杭州 · 西湖',
        people: [
            '林阿姨',
            '陈叔叔',
            '小雨'
        ],
        theme: '旅行',
        tags: [
            '西湖',
            '全家福',
            '夏天'
        ],
        story: '那是一个晴朗的夏天。我们一家三口去杭州，在西湖边坐了好久。小雨一路拉着妈妈的手，说长大以后还要带我们来。那天的风很轻，笑声却一直留在心里。',
        cover: '/demo/westlake.svg',
        favorite: true
    },
    {
        id: 'demo-home',
        title: '老院子里的桂花香',
        year: '1988',
        location: '苏州 · 老家',
        people: [
            '林阿姨',
            '外婆'
        ],
        theme: '老家',
        tags: [
            '桂花',
            '老院子',
            '故乡'
        ],
        story: '老家的院子里有一棵桂花树。每到秋天，外婆就搬一把竹椅坐在树下。我们一起摘桂花，晾好以后做桂花糕。院子很小，却装下了许多热闹的日子。',
        cover: '/demo/courtyard.svg',
        favorite: true
    },
    {
        id: 'demo-child',
        title: '小雨的第一个书包',
        year: '2001',
        location: '苏州 · 家里',
        people: [
            '小雨',
            '林阿姨'
        ],
        theme: '家人',
        tags: [
            '女儿',
            '童年',
            '开学'
        ],
        story: '小雨上小学的第一天，背着妈妈挑的红色书包，在门口站得特别直。妈妈帮她理好衣领，她回头挥挥手，说放学以后要讲学校里的新朋友。',
        cover: '/demo/childhood.svg',
        favorite: false
    },
    {
        id: 'demo-wedding',
        title: '红色喜字，新的家',
        year: '1986',
        location: '苏州 · 老家',
        people: [
            '林阿姨',
            '陈叔叔'
        ],
        theme: '家人',
        tags: [
            '婚礼',
            '结婚',
            '青春'
        ],
        story: '那年结婚，家里贴满了红色喜字。亲戚们围坐在一起，桌上是大家一早准备的饭菜。没有很大的排场，只有一屋子的祝福和笑声。',
        cover: '/demo/wedding.svg',
        favorite: false
    },
    {
        id: 'demo-newyear',
        title: '一起包饺子的除夕',
        year: '2010',
        location: '苏州 · 家里',
        people: [
            '林阿姨',
            '陈叔叔',
            '小雨'
        ],
        theme: '节日',
        tags: [
            '春节',
            '团圆',
            '饺子'
        ],
        story: '除夕下午，一家人围着桌子包饺子。爸爸擀皮，妈妈调馅，小雨包出来的饺子总是比别人大一圈。大家边笑边包，窗外的天慢慢暗了，屋里一直暖暖的。',
        cover: '/demo/newyear.svg',
        favorite: true
    },
    {
        id: 'demo-graduation',
        title: '毕业那天的合影',
        year: '1983',
        location: '南京 · 学校',
        people: [
            '林阿姨',
            '老同学'
        ],
        theme: '青春',
        tags: [
            '毕业',
            '大学',
            '年轻'
        ],
        story: '毕业那天，我们穿着干净的白衬衫，站在教学楼前合影。拍完照片，大家约好以后常常写信。那时的我们，对未来有好多好多期待。',
        cover: '/demo/graduation.svg',
        favorite: false
    },
    {
        id: 'demo-kitchen',
        title: '妈妈的拿手红烧肉',
        year: '2015',
        location: '苏州 · 家里',
        people: [
            '林阿姨',
            '小雨'
        ],
        theme: '日常',
        tags: [
            '做饭',
            '家常菜',
            '味道'
        ],
        story: '妈妈做红烧肉的时候，总是先把糖色炒得亮亮的，再慢慢炖。小雨一闻到香味就跑进厨房。妈妈说，等你学会了，也可以做给想念的人吃。',
        cover: '/demo/kitchen.svg',
        favorite: false
    },
    {
        id: 'demo-train',
        title: '绿皮火车上的远行',
        year: '1992',
        location: '南京 · 旅途',
        people: [
            '林阿姨',
            '陈叔叔'
        ],
        theme: '旅行',
        tags: [
            '火车',
            '出游',
            '年轻'
        ],
        story: '我们坐绿皮火车去看远方的朋友。窗外的田野一片接着一片，爸爸把带来的橘子剥好放在小桌上。那趟旅程很慢，我们却觉得一切都刚刚好。',
        cover: '/demo/train.svg',
        favorite: false
    }
];
const seedAlbums = [
    {
        id: 'album-family',
        title: '我们家的故事',
        description: '从两个人，到一个温暖的家',
        memoryIds: [
            'demo-wedding',
            'demo-child',
            'demo-newyear'
        ],
        cover: '/demo/wedding.svg',
        story: '',
        createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'album-travel',
        title: '一起走过的风景',
        description: '把路上的笑声，好好珍藏',
        memoryIds: [
            'demo-train',
            'demo-westlake'
        ],
        cover: '/demo/westlake.svg',
        story: '',
        createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
        id: 'album-home',
        title: '记忆里的老家',
        description: '熟悉的院子，熟悉的味道',
        memoryIds: [
            'demo-home',
            'demo-kitchen'
        ],
        cover: '/demo/courtyard.svg',
        story: '',
        createdAt: '2026-01-01T00:00:00.000Z'
    }
];
}),
"[project]/lib/store.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "all",
    ()=>all,
    "get",
    ()=>get,
    "log",
    ()=>log,
    "put",
    ()=>put,
    "remove",
    ()=>remove,
    "snapshot",
    ()=>snapshot
]);
var __TURBOPACK__url__external__node$3a$sqlite__ = __turbopack_context__.x("node:sqlite", ()=>require("node:sqlite"), true);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seed.mjs [app-route] (ecmascript)");
;
;
;
;
;
const dataDir = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data');
(0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["mkdirSync"])(dataDir, {
    recursive: true
});
const globalKey = '__yiban_database';
const db = globalThis[globalKey] || new __TURBOPACK__url__external__node$3a$sqlite__["DatabaseSync"](__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["default"].join(dataDir, 'yiban.sqlite'));
globalThis[globalKey] = db;
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(collection,id));`);
function all(collection) {
    return db.prepare('SELECT value FROM documents WHERE collection=?').all(collection).map((x)=>JSON.parse(x.value));
}
function get(collection, id) {
    const row = db.prepare('SELECT value FROM documents WHERE collection=? AND id=?').get(collection, id);
    return row ? JSON.parse(row.value) : null;
}
function put(collection, document) {
    db.prepare('INSERT INTO documents(collection,id,value) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET value=excluded.value').run(collection, document.id, JSON.stringify(document));
    return document;
}
function remove(collection, id) {
    db.prepare('DELETE FROM documents WHERE collection=? AND id=?').run(collection, id);
}
function log(type, text, memoryId = null) {
    return put('activity', {
        id: (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])(),
        type,
        text,
        memoryId,
        createdAt: new Date().toISOString()
    });
}
if (!get('system', 'initialized')) {
    for (const memory of __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["seedMemories"])put('memories', {
        ...memory,
        status: 'confirmed',
        assetType: 'illustration',
        audio: null,
        video: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        isDemo: true
    });
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seed$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["seedAlbums"].forEach((a)=>put('albums', a));
    put('settings', {
        id: 'family',
        familyName: '林家的记忆小屋',
        elderName: '林阿姨',
        fontSize: 'large',
        highContrast: false,
        autoPlay: false,
        speechRate: 0.85,
        demoNotice: true
    });
    [
        {
            id: 'member-1',
            name: '小雨',
            role: '管理员',
            relation: '女儿',
            color: 'peach'
        },
        {
            id: 'member-2',
            name: '陈叔叔',
            role: '家庭成员',
            relation: '丈夫',
            color: 'sage'
        },
        {
            id: 'member-3',
            name: '林阿姨',
            role: '老人',
            relation: '本人',
            color: 'lavender'
        }
    ].forEach((m)=>put('members', m));
    put('anniversaries', {
        id: 'anniversary-1',
        title: '林阿姨的生日',
        date: '03-18',
        memoryIds: [
            'demo-child',
            'demo-newyear'
        ]
    });
    put('system', {
        id: 'initialized',
        value: true
    });
}
function snapshot() {
    return {
        memories: all('memories').sort((a, b)=>b.createdAt.localeCompare(a.createdAt)),
        albums: all('albums'),
        members: all('members'),
        anniversaries: all('anniversaries'),
        activity: all('activity').sort((a, b)=>b.createdAt.localeCompare(a.createdAt)).slice(0, 300),
        settings: get('settings', 'family'),
        aiEnabled: Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL)
    };
}
}),
]})(),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[externals]/node:fs/promises [external] (node:fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:fs/promises", () => require("node:fs/promises"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1e9y4bsajvv5b._.js.map