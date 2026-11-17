// Shared DOM UI for Quarkade games: toasts, floating text, flying chips, modals, buttons, stars.
// Styles live in ./ui.css (games import it and define the colour variables listed there).
// Text comes from forge i18n, so games register the standard keys (see ./README in forge).

export interface UiElements {
  modalRoot: HTMLElement;
  toast: HTMLElement;
  fxLayer: HTMLElement;
}

export type ModalBuilder = (box: HTMLElement, close: () => void) => void;

export class Ui {
  readonly el: UiElements;
  /** Called whenever a modal opens or closes (true = something is open in modal-root). */
  onModalChange: (open: boolean) => void = () => {};
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(el: UiElements) {
    this.el = el;
  }

  get modalOpen(): boolean {
    return this.el.modalRoot.childElementCount > 0;
  }

  toast(msg: string, ms = 2600): void {
    const el = this.el.toast;
    el.textContent = msg;
    el.classList.add("show");
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  floatText(text: string, x: number, y: number): void {
    const el = document.createElement("div");
    el.className = "float-text";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.el.fxLayer.append(el);
    const anim = el.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: "translate(-50%,-160%)", opacity: 0 }], {
      duration: 900,
      easing: "ease-out",
    });
    anim.onfinish = () => el.remove();
    setTimeout(() => el.remove(), 1200);
  }

  /**
   * A small square of colour flying in an arc from one screen point to another (quilt patches,
   * drops into a tower...). Never waits forever: animations pause in background tabs.
   */
  flyChip(colour: string, from: { x: number; y: number }, to: { x: number; y: number }, delay = 0, cls = "patch-fly"): Promise<void> {
    return new Promise((resolve) => {
      const el = document.createElement("div");
      el.className = cls;
      el.style.background = colour;
      el.style.left = `${from.x}px`;
      el.style.top = `${from.y}px`;
      el.style.opacity = "0";
      this.el.fxLayer.append(el);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const anim = el.animate(
        [
          { transform: "translate(0,0) scale(0.6) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 60}px) scale(1.25) rotate(90deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.5) rotate(180deg)`, opacity: 1 },
        ],
        { duration: 650, delay, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
      );
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el.remove();
        resolve();
      };
      anim.onfinish = finish;
      setTimeout(finish, 650 + delay + 250);
    });
  }

  openModal(build: ModalBuilder, opts: { dismissable?: boolean } = {}): Promise<void> {
    return new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "modal-back";
      const box = document.createElement("div");
      box.className = "modal";
      back.append(box);
      const close = () => {
        back.remove();
        this.onModalChange(this.modalOpen);
        resolve();
      };
      if (opts.dismissable) back.addEventListener("click", (e) => e.target === back && close());
      build(box, close);
      this.el.modalRoot.append(back);
      this.onModalChange(true);
    });
  }

  button(label: string, cls: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = `btn ${cls}`.trim();
    b.innerHTML = label;
    b.disabled = disabled;
    b.addEventListener("click", onClick);
    return b;
  }
}

/** ★★☆ row with a pop-in animation. */
export function starsRow(stars: number, delay = 0.15): HTMLDivElement {
  const st = document.createElement("div");
  st.className = "stars";
  for (let i = 0; i < 3; i++) {
    const s = document.createElement("i");
    s.textContent = "★";
    if (i >= stars) s.className = "off";
    s.style.animationDelay = `${delay + i * 0.18}s`;
    st.append(s);
  }
  return st;
}

/** Paragraph helper. */
export function para(text: string, cls = ""): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = text;
  if (cls) p.className = cls;
  return p;
}
