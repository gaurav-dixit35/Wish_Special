import { createDog } from '../dog.js';

export const id = 12;
let scope;

function clock(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function init(ctx) {
  scope = ctx.scope;
  const s = scope;
  try {
    const { section, config, escape: e } = ctx;
    const copy = config.voiceUi;
    const paths = Array.isArray(config.voice) ? config.voice.filter((path) => typeof path === 'string' && path.trim()) : [];
    const tracks = paths.map((path, index) => ({ path,
      title: config.voiceTracks?.[index]?.title || copy.trackTitle.replace('{number}', String(index + 1)),
      note: config.voiceTracks?.[index]?.note || copy.trackNote,
      transcript: typeof config.voiceTracks?.[index]?.transcript === 'string' ? config.voiceTracks[index].transcript : '',
    }));
    let selected = 0;
    let ready = false;
    let leaving = false;
    let frame = null;
    section.setAttribute('aria-labelledby', 'voice-heading');
    section.innerHTML = `<div class="voice-content"><header class="voice-header"><p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>${e(copy.eyebrow)}</p><h1 id="voice-heading">${e(copy.title)}</h1><p>${e(copy.intro)}</p></header><div class="voice-card glass" aria-label="${e(copy.cardLabel)}"><div class="voice-card-orbit" aria-hidden="true"><i></i><i></i><i></i></div><p class="voice-dedication">${e(copy.dedication)}</p><p class="voice-track-number"></p><h2 class="voice-track-title"></h2><p class="voice-track-note"></p><div class="voice-player-well"><div class="voice-waveform" aria-hidden="true">${Array.from({ length: 32 }, (_, index) => `<i style="--bar-h:${28 + Math.round(34 * Math.sin(index / 31 * Math.PI))}px"></i>`).join('')}</div><button class="voice-play" data-testid="voice-play" type="button" aria-label="${e(copy.play)}" disabled><svg class="voice-play-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M15 10L31 20 15 30Z"/></svg><svg class="voice-pause-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M12 10H18V30H12ZM23 10H29V30H23Z"/></svg></button><p class="voice-button-label">${e(copy.play)}</p><div class="voice-timeline" aria-hidden="true"><span class="voice-elapsed">0:00</span><span class="voice-timeline-track"><i></i></span><span class="voice-duration">0:00</span></div></div><p class="voice-status" role="status" aria-live="polite"></p><p class="voice-missing-note" hidden>${e(copy.missing)}</p><p class="voice-muted-note" hidden>${e(copy.muted)}</p><p class="voice-headphones">${e(copy.headphones)}</p></div><nav class="voice-playlist" aria-label="${e(copy.playlist)}" ${tracks.length > 1 ? '' : 'hidden'}>${tracks.map((track, index) => `<button class="voice-track-choice" type="button" data-track="${index}" aria-label="${e(copy.selectTrack.replace('{number}', String(index + 1)).replace('{title}', track.title))}" aria-pressed="${index === 0}" disabled><span class="voice-track-disc" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span>${e(track.title)}</span><span class="voice-track-marker" aria-hidden="true">✦</span></button>`).join('')}</nav><div class="voice-actions">${ctx.hasChapter(13) ? `<button class="primary-button" data-testid="voice-next" type="button" disabled>${e(copy.skip)}</button>` : `<p>${e(copy.rest)}</p>`}${ctx.hasChapter(11) ? `<button class="secondary-button" data-testid="voice-back" type="button" disabled>${e(copy.back)}</button>` : ''}</div></div>`;
    createDog(ctx, { mount: section.querySelector('.voice-card'), variant: 8, className: 'dog-top voice-guide' });
    const player = ctx.audio.createVoicePlayer();
    if (!player) throw new Error('Voice player could not be created.');
    s.add(() => player.destroy());
    const play = section.querySelector('.voice-play');
    const bars = [...section.querySelectorAll('.voice-waveform i')];
    const next = section.querySelector('[data-testid="voice-next"]');
    const back = section.querySelector('[data-testid="voice-back"]');
    const trackButtons = [...section.querySelectorAll('.voice-track-choice')];
    const transcript = document.createElement('details');
    transcript.className = 'voice-transcript';
    transcript.innerHTML = `<summary>${e(copy.transcript)}</summary><p></p>`;
    transcript.hidden = true;
    section.querySelector('.voice-card').append(transcript);

    function stopBars() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      bars.forEach((bar, index) => {
        bar.style.transform = `scaleY(${.15 + .08 * Math.sin(index * .7)})`;
        bar.style.willChange = '';
      });
    }
    function drawBars(time) {
      try {
        frame = null;
        if (!s.alive || document.hidden || player.state.status !== 'playing' || ctx.reducedMotion || ctx.state.muted) { stopBars(); return; }
        player.levels(time).forEach((level, index) => { bars[index].style.transform = `scaleY(${level})`; });
        frame = requestAnimationFrame(drawBars);
      } catch (error) { stopBars(); if (s.alive) ctx.fail(error); }
    }
    function refresh() {
      if (!s.alive) return;
      const current = player.state;
      const track = tracks[selected];
      const missing = !track || current.status === 'unavailable';
      const playing = current.status === 'playing';
      const busy = playing || current.status === 'loading';
      section.dataset.voiceStatus = missing ? 'unavailable' : current.status;
      section.querySelector('.voice-track-title').textContent = track?.title || copy.comingSoon;
      section.querySelector('.voice-track-note').textContent = track?.note || copy.trackNote;
      transcript.hidden = !track?.transcript?.trim();
      transcript.querySelector('p').textContent = track?.transcript || '';
      section.querySelector('.voice-track-number').textContent = track ? copy.trackNumber.replace('{number}', String(selected + 1)).replace('{total}', String(tracks.length)) : '';
      const buttonLabel = busy ? copy.pause : current.status === 'paused' ? copy.resume : current.status === 'ended' ? copy.replay : copy.play;
      play.setAttribute('aria-label', buttonLabel);
      play.setAttribute('aria-pressed', String(busy));
      play.disabled = !ready || leaving || missing;
      section.querySelector('.voice-button-label').textContent = current.status === 'loading' ? copy.loading : missing ? copy.comingSoon : buttonLabel;
      section.querySelector('.voice-elapsed').textContent = clock(current.currentTime);
      section.querySelector('.voice-duration').textContent = clock(current.duration);
      section.querySelector('.voice-timeline-track i').style.transform = `scaleX(${current.duration > 0 ? Math.min(1, current.currentTime / current.duration) : 0})`;
      const status = missing ? copy.comingSoon : current.status === 'loading' ? copy.loading
        : playing ? copy.playing : current.status === 'paused' ? (current.reason === 'hidden' ? copy.hiddenPaused : current.reason === 'interrupted' ? copy.interrupted : copy.paused)
          : current.status === 'ended' ? copy.ended : copy.ready;
      const statusElement = section.querySelector('.voice-status');
      if (statusElement.textContent !== status) statusElement.textContent = status;
      section.querySelector('.voice-missing-note').hidden = !missing;
      section.querySelector('.voice-muted-note').hidden = !ctx.state.muted;
      section.querySelector('.voice-headphones').hidden = missing;
      trackButtons.forEach((button, index) => {
        button.disabled = !ready || leaving;
        button.setAttribute('aria-pressed', String(index === selected));
      });
      if (next) { next.disabled = !ready || leaving; next.textContent = current.status === 'ended' ? copy.next : copy.skip; }
      if (back) back.disabled = !ready || leaving;
      if (playing && !ctx.reducedMotion && !document.hidden && !ctx.state.muted) {
        if (frame === null) {
          bars.forEach((bar) => { bar.style.willChange = 'transform'; });
          frame = requestAnimationFrame(drawBars);
        }
      } else stopBars();
    }
    s.add(stopBars);
    s.add(player.subscribe(refresh));
    player.select(paths[0] || '');
    s.on(play, 'click', () => {
      if (!ready || leaving || !tracks[selected]) return;
      if (['playing', 'loading'].includes(player.state.status)) player.pause();
      else void player.play(tracks[selected].path);
    });
    trackButtons.forEach((button, index) => s.on(button, 'click', () => {
      if (!ready || leaving || selected === index) return;
      selected = index;
      transcript.open = false;
      player.select(tracks[index].path);
      refresh();
    }));
    s.on(document, 'birthday:soundchange', refresh);
    s.on(document, 'visibilitychange', () => {
      if (document.hidden) { player.pause('hidden'); stopBars(); }
      else refresh();
    });
    function leave(chapter) {
      if (!ready || leaving || !s.alive) return;
      leaving = true;
      player.pause('navigation');
      refresh();
      void ctx.go(chapter);
    }
    if (next) s.on(next, 'click', () => leave(13));
    if (back) s.on(back, 'click', () => leave(11));
    void (async () => {
      if (await ctx.entered === false || !s.alive) return;
      ready = true;
      refresh();
    })().catch((error) => { if (s.alive) ctx.fail(error); });
  } catch (error) { if (s.alive) ctx.fail(error); }
}

export function destroy() { scope?.destroy(); scope = null; }
