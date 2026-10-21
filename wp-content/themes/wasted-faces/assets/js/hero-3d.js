/**
 * 3D artwork carousel: paintings on a rotating cylinder.
 * Drag / swipe / trackpad / arrow keys / buttons; click the front painting to open it.
 */
(function () {
	'use strict';

	var root = document.querySelector('[data-hero3d]');
	if (!root) return;

	var stage = root.querySelector('[data-stage]');
	var ring = root.querySelector('[data-ring]');
	if (!stage || !ring) return;

	var cards = Array.prototype.slice.call(ring.querySelectorAll('[data-card]'));
	var n = cards.length;
	if (!n) return;

	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var step = 360 / n;
	var radius = 0;
	var pos = 0;          // Current rotation, in "cards" (float).
	var target = 0;       // Where pos is easing to.
	var tiltX = 0, tiltY = 0, tiltXT = 0, tiltYT = 0;
	var active = -1;
	var visible = true;
	var running = false;
	var lastInteract = performance.now();
	var AUTO_DELAY = 4200;

	var cap = {
		no: root.querySelector('[data-cap-no]'),
		title: root.querySelector('[data-cap-title]'),
		link: root.querySelector('[data-cap-link]'),
		artist: root.querySelector('[data-cap-artist]'),
		meta: root.querySelector('[data-cap-meta]'),
		index: root.querySelector('[data-cap-index]')
	};

	function mod(a, m) { return ((a % m) + m) % m; }

	// Shortest signed distance from a to b on a ring of size n.
	function ringDiff(a, b) {
		var d = mod(b - a, n);
		return d > n / 2 ? d - n : d;
	}

	function layout() {
		var w = cards[0].offsetWidth || 300;
		radius = n < 3 ? w : Math.round((w / 2) / Math.tan(Math.PI / n) * 1.18);
		cards.forEach(function (card, i) {
			card.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + radius + 'px)';
		});
		render();
	}

	function render() {
		ring.style.transform =
			'translateZ(' + (-radius) + 'px) rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + (-pos * step + tiltY).toFixed(3) + 'deg)';

		for (var i = 0; i < n; i++) {
			var d = Math.abs(ringDiff(pos, i));
			var shade = Math.min(1, d / Math.max(2.2, n / 3.2));
			cards[i].style.setProperty('--shade', shade.toFixed(3));
			cards[i].classList.toggle('is-front', d < 0.5);
		}

		var idx = mod(Math.round(pos), n);
		if (idx !== active) {
			active = idx;
			updateCaption();
		}
	}

	function updateCaption() {
		var c = cards[active];
		if (!c) return;
		cap.no.textContent = c.dataset.no ? 'No. ' + c.dataset.no : '';
		cap.title.textContent = c.dataset.title || '';
		cap.link.setAttribute('href', c.dataset.url || '#');
		cap.artist.textContent = c.dataset.artist || '';
		cap.meta.textContent = c.dataset.meta || '';
		cap.index.textContent = String(active + 1).padStart(2, '0');
		cards.forEach(function (card, i) {
			card.setAttribute('aria-hidden', i === active ? 'false' : 'true');
		});
	}

	function tick(now) {
		if (!visible) { running = false; return; }

		if (!reduceMotion && !dragging && now - lastInteract > AUTO_DELAY && !hovering && !document.hidden) {
			target += 1;
			lastInteract = now;
		}

		var ease = reduceMotion ? 1 : 0.085;
		pos += (target - pos) * ease;
		if (Math.abs(target - pos) < 0.0005) pos = target;

		tiltX += (tiltXT - tiltX) * 0.06;
		tiltY += (tiltYT - tiltY) * 0.06;

		render();
		requestAnimationFrame(tick);
	}

	function start() {
		if (running) return;
		running = true;
		requestAnimationFrame(tick);
	}

	function go(delta) {
		target = Math.round(target) + delta;
		lastInteract = performance.now();
		start();
	}

	function goTo(i) {
		target = Math.round(pos) + ringDiff(Math.round(pos), i);
		lastInteract = performance.now();
		start();
	}

	/* ---------------- Pointer: drag / swipe ---------------- */

	var dragging = false, moved = 0, startX = 0, startPos = 0, lastX = 0, lastT = 0, vel = 0, hovering = false;

	stage.addEventListener('pointerdown', function (e) {
		if (e.button !== undefined && e.button !== 0) return;
		dragging = true;
		moved = 0;
		startX = lastX = e.clientX;
		startPos = pos;
		lastT = performance.now();
		vel = 0;
		stage.classList.add('is-dragging');
		lastInteract = performance.now();
		start();
	});

	window.addEventListener('pointermove', function (e) {
		if (!dragging) return;
		var w = cards[0].offsetWidth || 300;
		var dx = e.clientX - startX;
		moved = Math.max(moved, Math.abs(dx));
		if (moved > 6 && !stage.hasPointerCapture(e.pointerId)) {
			try { stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
		}
		var now = performance.now();
		var dt = Math.max(1, now - lastT);
		vel = 0.8 * vel + 0.2 * ((e.clientX - lastX) / dt);
		lastX = e.clientX;
		lastT = now;
		pos = target = startPos - dx / (w * 0.95);
		lastInteract = now;
	});

	function endDrag() {
		if (!dragging) return;
		dragging = false;
		stage.classList.remove('is-dragging');
		var w = cards[0].offsetWidth || 300;
		var fling = -vel * 260 / w;
		target = Math.round(pos + Math.max(-3, Math.min(3, fling)));
		lastInteract = performance.now();
	}
	window.addEventListener('pointerup', endDrag);
	window.addEventListener('pointercancel', endDrag);

	// A click after a drag must not open the painting; a click on a side painting turns to it.
	ring.addEventListener('click', function (e) {
		var card = e.target.closest('[data-card]');
		if (!card) return;
		if (moved > 6) { e.preventDefault(); return; }
		var i = cards.indexOf(card);
		if (i !== active) {
			e.preventDefault();
			goTo(i);
		}
	});

	ring.addEventListener('dragstart', function (e) { e.preventDefault(); });

	// Horizontal trackpad / shift+wheel.
	var wheelAcc = 0, wheelTimer = 0;
	stage.addEventListener('wheel', function (e) {
		var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
		if (!dx) return;
		e.preventDefault();
		wheelAcc += dx;
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(function () { wheelAcc = 0; }, 180);
		if (Math.abs(wheelAcc) > 60) {
			go(wheelAcc > 0 ? 1 : -1);
			wheelAcc = 0;
		}
	}, { passive: false });

	// Gentle parallax tilt following the mouse.
	stage.addEventListener('pointermove', function (e) {
		if (reduceMotion || e.pointerType !== 'mouse' || dragging) return;
		var r = stage.getBoundingClientRect();
		tiltYT = ((e.clientX - r.left) / r.width - 0.5) * 7;
		tiltXT = -((e.clientY - r.top) / r.height - 0.5) * 5;
		start();
	});
	stage.addEventListener('pointerenter', function () { hovering = true; });
	stage.addEventListener('pointerleave', function () {
		hovering = false;
		tiltXT = tiltYT = 0;
	});

	/* ---------------- Keyboard & buttons ---------------- */

	stage.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
		else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
		else if (e.key === 'Enter' && cards[active]) { window.location.href = cards[active].dataset.url; }
	});
	stage.addEventListener('focusin', function () { hovering = true; });
	stage.addEventListener('focusout', function () { hovering = false; });

	var prev = root.querySelector('[data-prev]');
	var next = root.querySelector('[data-next]');
	if (prev) prev.addEventListener('click', function () { go(-1); });
	if (next) next.addEventListener('click', function () { go(1); });

	/* ---------------- Lifecycle ---------------- */

	if ('IntersectionObserver' in window) {
		new IntersectionObserver(function (entries) {
			visible = entries[0].isIntersecting;
			if (visible) start();
		}).observe(root);

		// The header already offers the concierge, so the floating button waits until the hero is scrolled past.
		new IntersectionObserver(function (entries) {
			var shown = entries[0].intersectionRect.height / window.innerHeight;
			document.body.classList.toggle('hero-in-view', shown > 0.55);
		}, { threshold: [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }).observe(root);
	}

	var resizeTimer = 0;
	window.addEventListener('resize', function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(layout, 120);
	});

	layout();
	root.classList.add('is-ready');
	start();
})();
