/**
 * encode-stacked-alpha.ts — 把预设宠物的 VP9-alpha WebM 批量转码为 stacked-alpha 堆叠视频。
 *
 * 背景（issue #434）：macOS WKWebView / Linux WebKitGTK 不支持 VP9-alpha 透明 WebM
 * （解码丢 alpha 平面 → 黑底）。stacked-alpha 方案把透明信息搬进 luma 平面：视频高度
 * 翻倍，上半像素 = 颜色，下半像素 = alpha 亮度，前端 WebGL shader 在运行时合成透明。
 * 产物是「普通不透明编码」（hvc1/av01/avc1 均可），无需 HEVC-with-Alpha 专属 API——
 * 这正是本脚本与上游 source/dsh-pet/scripts/encode_hevc_alpha.sh 的差异：上游走
 * macOS 原生 AVAssetWriter + hevcWithAlpha（仅 macOS 可用），stacked 版任何能解码
 * WebM + 编码 hvc1/av01 的工具链都能产出，ffmpeg 只是默认实现。
 *
 * 用法：
 *   pnpm tsx scripts/encode-stacked-alpha.ts <输入 webm 目录> <输出目录> [编码器]
 *   编码器：hvc1（默认，libx265，Safari/Chromium 都认）| av01（libaom-av1，体积更小）
 *
 * 输出：<stem>.mp4，与输入 webm 同名主键，内容为 vstack 堆叠（上半颜色 + 下半 alpha）。
 * 产物放置：<已安装预设目录>/stacked/<stem>.mp4，由 preset_pet.rs 的 stacked manifest
 * 自动发现（见 src-tauri/src/bridge/preset_pet.rs get_preset_pet_assets）。
 *
 * 转码管线参考 jakearchibald "Video with alpha transparency on the web"（2024-08）：
 *   https://jakearchibald.com/2024/video-with-transparency/
 *   [0:v]format=pix_fmts=yuva444p[main];[main]split[main][alpha];
 *   [alpha]alphaextract[alpha];[main][alpha]vstack
 *
 * 说明：
 * - 输入端解码必须显式 -c:v libvpx-vp9（libvpx 解码才保留 VP9 alpha，ffmpeg 自动选
 *   解码器会丢 alpha 导致黑底——与 source/dsh-pet/scripts 各脚本同一纪律）;
 * - 输出端是普通 yuv420p（无 alpha 平面），因此任何支持 hvc1/av01 的编码器均可替代
 *   ffmpeg（如 macOS AVAssetWriter、GStreamer vah265enc 等）；不想引入 ffmpeg 时，
 *   用系统自带的解码/编码库实现同一条 filter 链即可，本脚本仅作参考实现;
 * - 断点续跑：输出比源新则跳过。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'

const [, , inputDir, outputDir, encoderArg = 'hvc1'] = process.argv
if (!inputDir || !outputDir) {
  console.error('usage: pnpm tsx scripts/encode-stacked-alpha.ts <input webm dir> <output dir> [hvc1|av01]')
  process.exit(1)
}
const encoder = encoderArg === 'av01' ? 'av01' : 'hvc1'

const filter = '[0:v]format=pix_fmts=yuva444p[main];[main]split[main][alpha];[alpha]alphaextract[alpha];[main][alpha]vstack'
const args = encoder === 'av01'
  ? ['-c:v', 'libaom-av1', '-crf', '45', '-cpu-used', '3', '-b:v', '0']
  : ['-c:v', 'libx265', '-tag:v', 'hvc1', '-preset', 'medium', '-crf', '30', '-b:v', '0']

mkdirSync(outputDir, { recursive: true })
const files = readdirSync(inputDir).filter(file => file.endsWith('.webm')).sort()
if (files.length === 0) {
  console.error(`no .webm files in ${inputDir}`)
  process.exit(1)
}

let converted = 0
let skipped = 0
for (const file of files) {
  const src = join(inputDir, file)
  const stem = file.slice(0, -'.webm'.length)
  const dst = join(outputDir, `${stem}.mp4`)
  if (existsNewer(dst, src)) {
    skipped++
    continue
  }
  console.log(`[${converted + skipped + 1}/${files.length}] ${file} → ${encoder}`)
  const result = spawnSync(FFMPEG, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-c:v',
    'libvpx-vp9',
    '-i',
    src,
    '-an',
    '-filter_complex',
    filter,
    '-pix_fmt',
    'yuv420p',
    ...args,
    dst,
  ], { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`encode failed: ${file} (ffmpeg exit ${result.status ?? 'signal'})`)
    process.exit(1)
  }
  converted++
}
console.log(`done: converted=${converted} skipped=${skipped} total=${files.length} out=${outputDir}`)

function existsNewer(dst: string, src: string): boolean {
  try {
    return statSync(dst).mtimeMs > statSync(src).mtimeMs
  }
  catch {
    return false
  }
}
