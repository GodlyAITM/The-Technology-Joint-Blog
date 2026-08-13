/**
 * Minimal toast notifications for the Studio workspace.
 *
 * A single stacked container is created on first use; each toast is an
 * auto-dismissing pill with a slide-in animation. Styles live in studio.css
 * (.studio-toast, .studio-toast-stack, .studio-toast--*).
 */

export type ToastKind = "info" | "success" | "error";

const STACK_ID = "studio-toast-stack";
const DEFAULT_DURATION = 4200;

function stack(): HTMLElement {
    let el = document.getElementById(STACK_ID);
    if (!el) {
        el = document.createElement("div");
        el.id = STACK_ID;
        el.className = "studio-toast-stack";
        el.setAttribute("aria-live", "polite");
        document.body.appendChild(el);
    }
    return el;
}

export function showToast(
    message: string,
    kind: ToastKind = "info",
    duration = DEFAULT_DURATION,
): void {
    const toast = document.createElement("div");
    toast.className = `studio-toast studio-toast--${kind}`;
    toast.setAttribute("role", "status");
    toast.textContent = message;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "studio-toast__close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    close.addEventListener("click", () => remove());
    toast.appendChild(close);

    function remove() {
        toast.classList.add("is-leaving");
        window.setTimeout(() => toast.remove(), 180);
    }

    const timer = window.setTimeout(remove, duration);
    toast.addEventListener("mouseenter", () => window.clearTimeout(timer));
    toast.addEventListener("mouseleave", () => {
        window.clearTimeout(timer);
        window.setTimeout(remove, duration);
    });

    stack().appendChild(toast);
    // Force a reflow so the enter transition plays.
    void toast.offsetWidth;
    toast.classList.add("is-visible");
}
