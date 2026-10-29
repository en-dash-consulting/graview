/*
 * `@graview/pages/splash` — AN APP'S OPENING SCREEN, AS A HOST'S FIRST HTML
 * (Roadmap f-splash-in-document).
 *
 * What a page shows in its first second, while the app's code loads, and
 * takes away the moment a place has drawn. Graview Cloud kept it as a
 * setting of its own; now it is `brand.splash` in the document, and this is
 * the one renderer of it: a string of HTML, a stylesheet and a small script
 * a host inlines before the app's root, with no React, nothing of the
 * framework and nothing to fetch — a page carrying the framework's bundle
 * to draw its loading screen would wait for the bundle it is covering for.
 * `graview preview` inlines it; Graview Cloud's shell may do the same.
 *
 * The screen stands in the browser's top layer (`popover="manual"`, shown
 * by the script the moment it is parsed): above every rung of the ladder
 * (`@graview/core`'s `LAYERS`) by the browser's say, with no `z-index` of
 * its own, and never shown at all where no script runs. The script watches
 * for `data-graview-drawn` (the embed says it once the place has drawn and
 * settled, FR-188) — or a page error said as an alert, or fifteen seconds
 * — then fades the screen out and removes it. Reduced motion takes it away
 * at once and draws nothing that moves; so does a browser driven by
 * automation (`navigator.webdriver`), or a host that says `fade: false`,
 * so a picture of the page is never taken through a screen half gone.
 *
 * The screen is a status (`role="status"`, named by its title): a reader
 * hears that the app is opening, and nothing it types on is read twice.
 * Its words are the brand's — one brand for the app — unless the host says
 * a page's own (`title`, `kicker`): the place being opened, set large. The
 * styles:
 *
 *   plain      the ground, the app's mark and its name;
 *   editorial  the image full-bleed, the title very large at the foot;
 *   shader     the image drifting through one of the shaders shipped here,
 *              named by `shader` — never written in a document, since data
 *              is never code; WebGL refused, the editorial screen shows;
 *   ascii      the image as characters in the tint, the title typing on.
 *
 * The data it reads is what `graview check` admitted: a mark as the logo
 * takes one, a title and a kicker as words. It escapes them all the same.
 */

/** The styles an opening screen draws in: the same list as `SPLASH_STYLES` on `@graview/core/document`. */
export const SPLASH_STYLES = ["plain", "editorial", "shader", "ascii"] as const;
export type SplashStyle = (typeof SPLASH_STYLES)[number];
/** The shaders shipped here by name: the same list as `SPLASH_SHADERS` on `@graview/core/document`. */
export const SPLASH_SHADERS = ["drift", "ripple", "veil", "caustics"] as const;
export type SplashShader = (typeof SPLASH_SHADERS)[number];

/** The id of the screen's element, which the script finds and takes away. */
export const SPLASH_ID = "graview-splash";

/** `brand.splash` as the document holds it. */
export interface SplashSpec {
  readonly style: SplashStyle;
  /** A mark as the logo is one: inline SVG, or a path on the app's own host. */
  readonly image?: string;
  /** The words set large; the app's name when unsaid. */
  readonly title?: string;
  /** One small line over the title. */
  readonly kicker?: string;
  /** For the shader style: one of `SPLASH_SHADERS`; the first when unsaid. */
  readonly shader?: string;
}

/** What of a document's brand the screen reads: its words, colors, face and the screen itself. */
export interface SplashBrand {
  readonly name?: string;
  readonly accent?: string;
  readonly ground?: string | { readonly light?: string; readonly dark?: string };
  readonly scheme?: "light" | "dark" | "auto";
  readonly typography?: { readonly display?: string };
  readonly logo?: string | { readonly src: string } | { readonly light: string; readonly dark?: string };
  readonly splash?: SplashSpec;
}

export interface SplashOptions {
  /** The scheme the page opens in: the brand's, else `auto` (the reader's system). */
  readonly scheme?: "light" | "dark" | "auto";
  /** The app's name where the brand names none (a document's `name`). */
  readonly name?: string;
  /**
   * THIS PAGE'S OWN WORDS (Roadmap splash-html-takes-where-it-opens): the
   * place it opens on, set large, over the brand's `splash.title` for this
   * page alone — the brand is one for the app, a page's opening words are
   * the place's. An empty `kicker` says none.
   */
  readonly title?: string;
  readonly kicker?: string;
  /** Whether the screen fades as it goes (320 ms). It does unless `false`, a reader asks for less motion, or automation drives the browser. */
  readonly fade?: boolean;
}

/** The screen as a host inlines it: the markup, its stylesheet and the script that takes it away. */
export interface Splash {
  readonly html: string;
  readonly css: string;
  readonly script: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_FACE = /^[A-Za-z0-9 ,'"-]{1,200}$/;
const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SYSTEM_SERIF = 'Georgia, "Times New Roman", serif';
const SYSTEM_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A mark as an `<img>` takes it: inline SVG as a data URI, a path as given; nothing for a mark that is neither. */
function imageHref(mark: string | undefined): string | undefined {
  if (!mark) return undefined;
  const trimmed = mark.trim();
  if (/^<svg[\s>]/i.test(trimmed) && !/<script|\bon[a-z]+\s*=|javascript:/i.test(trimmed)) return `data:image/svg+xml,${encodeURIComponent(trimmed)}`;
  if (/^</.test(trimmed) || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return undefined;
  return /^[A-Za-z0-9._~/-]+$/.test(trimmed) ? trimmed : undefined;
}

function logoFor(logo: SplashBrand["logo"], scheme: "light" | "dark"): string | undefined {
  if (!logo) return undefined;
  if (typeof logo === "string") return logo;
  if ("src" in logo) return logo.src;
  return scheme === "dark" && logo.dark ? logo.dark : logo.light;
}

function face(display: string | undefined): string {
  if (!display) return SYSTEM_SANS;
  if (display === "system-serif") return SYSTEM_SERIF;
  if (display === "system-mono") return SYSTEM_MONO;
  if (display === "system-sans") return SYSTEM_SANS;
  return SAFE_FACE.test(display) ? display : SYSTEM_SANS;
}

/** The ground and ink of each scheme: the brand's grounds where they read as hex, the framework's otherwise. */
function colors(brand: SplashBrand) {
  const given = typeof brand.ground === "string" ? { light: brand.ground } : (brand.ground ?? {});
  const light = given.light && HEX.test(given.light) ? given.light : "#f7f7f2";
  const dark = given.dark && HEX.test(given.dark) ? given.dark : "#0a0f1f";
  const accent = brand.accent && HEX.test(brand.accent) ? brand.accent : undefined;
  return { light, dark, tintLight: accent ?? "#001769", tintDark: accent ?? "#9aabff", inkLight: "#18213a", inkDark: "#e8ecf5" };
}

/** A hex color as `r, g, b` in 0..1, for the shader's uniform. */
function rgb(hex: string): string {
  return [1, 3, 5].map((at) => (parseInt(hex.slice(at, at + 2), 16) / 255).toFixed(3)).join(",");
}

/**
 * THE SCREEN AS STRINGS. `html` is one element, `#graview-splash`, carrying
 * its style and scheme as data attributes; `css` is scoped to it; `script`
 * is plain, synchronous and self-contained, to be inlined after the markup.
 * A brand with no `splash` answers empty strings: nothing to inline.
 */
export function splashHtml(brand: SplashBrand, options: SplashOptions = {}): Splash {
  const spec = brand.splash;
  if (!spec || !(SPLASH_STYLES as readonly string[]).includes(spec.style)) return { html: "", css: "", script: "" };
  const scheme = options.scheme ?? brand.scheme ?? "auto";
  const { light, dark, tintLight, tintDark, inkLight, inkDark } = colors(brand);
  const title = options.title ?? spec.title ?? brand.name ?? options.name ?? "";
  const kicker = options.kicker ?? spec.kicker;
  const shader = spec.style === "shader" ? ((SPLASH_SHADERS as readonly string[]).includes(spec.shader ?? "") ? spec.shader! : SPLASH_SHADERS[0]) : undefined;
  const picture = imageHref(spec.image);
  // The plain screen stands the app's mark over its name where the screen has no image of its own.
  const markLight = picture ?? (spec.style === "plain" ? imageHref(logoFor(brand.logo, "light")) : undefined);
  const markDark = picture ?? (spec.style === "plain" ? imageHref(logoFor(brand.logo, "dark")) : undefined);
  const mark = (src: string | undefined, which: "light" | "dark") => (src ? `<img class="graview-splash-image" data-scheme="${which}" src="${escape(src)}" alt="" decoding="async">` : "");
  const images = spec.style === "plain" ? (markLight === markDark ? mark(markLight, "light").replace(' data-scheme="light"', "") : mark(markLight, "light") + mark(markDark, "dark")) : mark(picture, "light").replace(' data-scheme="light"', "");
  // The ascii title types itself on; a reader hears the whole of it once, in the screen's name, not letter by letter.
  const words = `${kicker ? `<p class="graview-splash-kicker">${escape(kicker)}</p>` : ""}<p class="graview-splash-title"${spec.style === "ascii" ? ` data-types="${escape(title)}" aria-hidden="true"` : ""}>${spec.style === "ascii" ? "" : escape(title)}</p>`;
  const html = `<div id="${SPLASH_ID}" popover="manual" data-style="${spec.style}" data-scheme="${scheme}"${shader ? ` data-shader="${shader}"` : ""} data-tint-light="${rgb(tintLight)}" data-tint-dark="${rgb(tintDark)}"${options.fade === false ? " data-fade=\"off\"" : ""} role="status" aria-label="${escape(title)}">${images}${spec.style === "ascii" ? '<pre class="graview-splash-ascii" aria-hidden="true"></pre>' : ""}${spec.style === "shader" ? '<canvas class="graview-splash-canvas" aria-hidden="true"></canvas>' : ""}<div class="graview-splash-words">${words}</div></div>`;

  const id = `#${SPLASH_ID}`;
  const darkRules = `--gs-ground:${dark};--gs-ink:${inkDark};--gs-tint:${tintDark};--gs-light:0`;
  const css = [
    `${id}{--gs-ground:${light};--gs-ink:${inkLight};--gs-tint:${tintLight};--gs-light:1;position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;background:var(--gs-ground);color:var(--gs-ink);font-family:${face(brand.typography?.display)};transition:opacity .28s ease}`,
    `${id}::backdrop{background:transparent}`,
    `${id}[data-scheme="dark"]{${darkRules}}`,
    `@media (prefers-color-scheme: dark){${id}[data-scheme="auto"]{${darkRules}}}`,
    `${id}[data-gone]{opacity:0;pointer-events:none}`,
    `${id} .graview-splash-words{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(24px,6vw,72px);box-sizing:border-box}`,
    `${id} .graview-splash-kicker{margin:0 0 .6em;font:600 clamp(12px,1.4vw,15px)/1.3 ${SYSTEM_SANS};letter-spacing:.14em;text-transform:uppercase;color:var(--gs-tint)}`,
    `${id} .graview-splash-title{margin:0;font-size:clamp(40px,9vw,128px);font-weight:600;line-height:.95;letter-spacing:-.03em;max-width:14ch;overflow-wrap:anywhere}`,
    `${id} .graview-splash-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}`,
    `${id}[data-style="editorial"] .graview-splash-words,${id}[data-style="shader"] .graview-splash-words{background:linear-gradient(to top,var(--gs-ground) 0,transparent 55%)}`,
    `${id}[data-style="plain"] .graview-splash-words{justify-content:center;align-items:center;text-align:center}`,
    `${id}[data-style="plain"] .graview-splash-title{font-size:clamp(28px,5vw,56px);letter-spacing:-.02em}`,
    `${id}[data-style="plain"] .graview-splash-image{position:static;width:min(160px,30vw);height:auto;max-height:160px;object-fit:contain;margin:0 auto 24px}`,
    `${id}[data-style="plain"] .graview-splash-image[data-scheme="dark"]{display:none}`,
    `${id}[data-scheme="dark"][data-style="plain"] .graview-splash-image[data-scheme="light"]{display:none}${id}[data-scheme="dark"][data-style="plain"] .graview-splash-image[data-scheme="dark"]{display:block}`,
    `@media (prefers-color-scheme: dark){${id}[data-scheme="auto"][data-style="plain"] .graview-splash-image[data-scheme="light"]{display:none}${id}[data-scheme="auto"][data-style="plain"] .graview-splash-image[data-scheme="dark"]{display:block}}`,
    `${id} .graview-splash-canvas{position:absolute;inset:0;width:100%;height:100%}`,
    `${id}[data-style="ascii"] .graview-splash-image{visibility:hidden}`,
    `${id} .graview-splash-ascii{position:absolute;inset:0;margin:0;padding:0;overflow:hidden;font:12px/14px ${SYSTEM_MONO};color:var(--gs-tint);opacity:.85;white-space:pre;user-select:none}`,
    `${id}[data-style="ascii"] .graview-splash-title{font-family:${SYSTEM_MONO};font-weight:500}`,
    `${id}[data-style="ascii"] .graview-splash-title::after{content:"_";animation:graview-splash-blink 1s steps(2) infinite}`,
    `@keyframes graview-splash-blink{to{visibility:hidden}}`,
    `@media (prefers-reduced-motion: reduce){${id}{transition:none}${id}[data-style="ascii"] .graview-splash-title::after{animation:none;content:""}}`,
  ].join("\n");

  return { html, css, script: SCRIPT };
}

/**
 * ONE SCRIPT FOR EVERY STYLE, plain ES5 so it parses anywhere: it takes the
 * screen away when the place has drawn, and draws the ascii field or runs
 * the named shader meanwhile. Reduced motion draws one still frame.
 */
const SCRIPT = String.raw`(function(){
var s=document.getElementById("graview-splash");if(!s)return;
if(s.showPopover){try{s.showPopover()}catch(e){}}
var mq=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):null,still=!!(mq&&mq.matches),quick=still||navigator.webdriver===true||s.getAttribute("data-fade")==="off";
var dark=s.getAttribute("data-scheme")==="dark"||(s.getAttribute("data-scheme")==="auto"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
var tint=(s.getAttribute(dark?"data-tint-dark":"data-tint-light")||"0,0,0").split(",").map(Number);
var stop=null,gone=false,t0=Date.now();
function go(){if(gone)return;gone=true;ob.disconnect();clearTimeout(most);if(stop)stop();if(quick){if(s.parentNode)s.parentNode.removeChild(s);return}
s.setAttribute("data-gone","");setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s)},320)}
function drawn(){return !!document.querySelector("[data-graview-drawn],[role=alert]")}
var ob=new MutationObserver(function(){if(drawn())go()});
ob.observe(document.documentElement,{attributes:true,childList:true,subtree:true,attributeFilter:["data-graview-drawn","role"]});
var most=setTimeout(go,15000);
if(drawn()){go();return}
var style=s.getAttribute("data-style"),img=s.querySelector(".graview-splash-image");
function ready(fn){if(!img){fn(null);return}if(img.complete&&img.naturalWidth)fn(img);else{img.addEventListener("load",function(){fn(img)});img.addEventListener("error",function(){fn(null)})}}
function loop(frame){if(still){frame(0);return}var on=true,last=0;function tick(now){if(!on)return;if(now-last>66){last=now;frame((Date.now()-t0)/1000)}requestAnimationFrame(tick)}requestAnimationFrame(tick);stop=function(){on=false}}
if(style==="ascii"){
var pre=s.querySelector(".graview-splash-ascii"),title=s.querySelector(".graview-splash-title"),words=title?title.getAttribute("data-types")||"":"";
var ramp=dark?" .:-=+*#%@":"@%#*+=-:. ";
var cv=document.createElement("canvas"),cx=cv.getContext("2d",{willReadFrequently:true});
ready(function(im){var cols=Math.ceil(s.clientWidth/7.2),rows=Math.ceil(s.clientHeight/14);cv.width=cols;cv.height=rows;
var px=null;if(im&&cx){try{var r=Math.max(cols/im.naturalWidth,rows/im.naturalHeight),w=im.naturalWidth*r,h=im.naturalHeight*r;cx.drawImage(im,(cols-w)/2,(rows-h)/2,w,h);px=cx.getImageData(0,0,cols,rows).data}catch(e){px=null}}
loop(function(t){var out="",p=Math.min(1,t/1.6);for(var y=0;y<rows;y++){for(var x=0;x<cols;x++){var v;if(px){var i=(y*cols+x)*4;v=(px[i]*.3+px[i+1]*.59+px[i+2]*.11)/255}else{v=.5+.5*Math.sin(x*.11+t*.6)*Math.cos(y*.19-t*.4)}
if(dark)v=v*p;else v=1-(1-v)*p;out+=ramp.charAt(Math.max(0,Math.min(ramp.length-1,Math.floor(v*(ramp.length-1)))))}out+="\n"}pre.textContent=out});
});
if(title&&words){if(still)title.textContent=words;else{var n=0,ty=setInterval(function(){n++;title.textContent=words.slice(0,n);if(n>=words.length)clearInterval(ty)},Math.max(30,Math.min(90,1200/words.length)));var before=stop;stop=function(){clearInterval(ty);if(before)before()}}}
}
if(style==="shader"){
var canvas=s.querySelector(".graview-splash-canvas"),gl=canvas&&(canvas.getContext("webgl",{premultipliedAlpha:false})||canvas.getContext("experimental-webgl"));
var which=s.getAttribute("data-shader")||"drift";
var F={drift:"vec2 d=vec2(sin(u_time*.21)*.02,cos(u_time*.17)*.02);vec2 q=(uv-.5)*(1.06-.04*u_progress)+.5+d;q+=vec2(sin(q.y*6.+u_time*.5),cos(q.x*5.-u_time*.4))*.004;vec3 c=pic(q);c=mix(c,u_tint,(1.-u_progress)*.35+.12*(1.-uv.y));",
ripple:"vec2 p=uv-.5;p.x*=u_resolution.x/u_resolution.y;float r=length(p);float w=sin(r*28.-u_time*2.6)*exp(-r*2.2)*.012*(1.-u_progress*.6);vec3 c=pic(uv+normalize(p+1e-5)*w);c=mix(c,u_tint,.18*(1.-u_progress)+.1*(1.-uv.y));",
veil:"vec3 c=pic(uv);float band=smoothstep(-.3,.3,uv.x-uv.y*.6+sin(u_time*.35)*.25-.2);c=mix(c,u_tint,(.55-.4*u_progress)*band+.1*(1.-uv.y));",
caustics:"vec2 p=(uv-.5)*vec2(u_resolution.x/u_resolution.y,1.)*5.;vec2 i=p;float k=1.;for(int n=0;n<4;n++){float t=u_time*.3*(1.-3.5/float(n+1));i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));k+=1./length(vec2(p.x/(sin(i.x+t)/.005),p.y/(cos(i.y+t)/.005)));}k=1.17-pow(k/4.,1.4);float l=clamp(pow(abs(k),8.),0.,1.);vec3 c=pic(uv+vec2(sin(i.x),cos(i.y))*.004);c=mix(c,u_tint,(1.-u_progress)*.3+.1*(1.-uv.y));c+=l*(.18+.22*u_light)*(1.-.5*u_progress);"};
if(gl){
var vs="attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
var fs="precision mediump float;uniform sampler2D u_image;uniform float u_time,u_progress,u_light,u_has;uniform vec2 u_resolution,u_size;uniform vec3 u_tint,u_ground;"+
"vec3 pic(vec2 q){if(u_has<.5){return mix(u_ground,u_tint,.25+.35*q.y);}float ra=u_resolution.x/u_resolution.y,ia=u_size.x/u_size.y;vec2 t=q;if(ra>ia){t.y=(q.y-.5)*ia/ra+.5;}else{t.x=(q.x-.5)*ra/ia+.5;}return texture2D(u_image,vec2(t.x,1.-t.y)).rgb;}"+
"void main(){vec2 uv=gl_FragCoord.xy/u_resolution;"+(F[which]||F.drift)+"gl_FragColor=vec4(c,1.);}";
function sh(type,src){var o=gl.createShader(type);gl.shaderSource(o,src);gl.compileShader(o);return gl.getShaderParameter(o,gl.COMPILE_STATUS)?o:null}
var v=sh(gl.VERTEX_SHADER,vs),f=sh(gl.FRAGMENT_SHADER,fs),prog=v&&f&&gl.createProgram();
if(prog){gl.attachShader(prog,v);gl.attachShader(prog,f);gl.linkProgram(prog)}
if(prog&&gl.getProgramParameter(prog,gl.LINK_STATUS)){gl.useProgram(prog);
var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
var a=gl.getAttribLocation(prog,"a");gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
var U=function(n){return gl.getUniformLocation(prog,n)};
var tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
var g=getComputedStyle(s).backgroundColor.match(/[\d.]+/g)||[0,0,0];
gl.uniform3f(U("u_tint"),tint[0],tint[1],tint[2]);gl.uniform3f(U("u_ground"),g[0]/255,g[1]/255,g[2]/255);gl.uniform1f(U("u_light"),dark?0:1);gl.uniform1f(U("u_has"),0);gl.uniform2f(U("u_size"),1,1);
ready(function(im){if(!im)return;try{gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.uniform1f(U("u_has"),1);gl.uniform2f(U("u_size"),im.naturalWidth,im.naturalHeight)}catch(e){}});
loop(function(t){var w=s.clientWidth,h=s.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==(w*dpr|0)||canvas.height!==(h*dpr|0)){canvas.width=w*dpr;canvas.height=h*dpr;gl.viewport(0,0,canvas.width,canvas.height)}
gl.uniform1f(U("u_time"),t);gl.uniform1f(U("u_progress"),Math.min(1,t/2.4));gl.uniform2f(U("u_resolution"),canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLES,0,3)});
}else if(canvas)canvas.remove()}else if(canvas)canvas.remove();
}
})();`;
