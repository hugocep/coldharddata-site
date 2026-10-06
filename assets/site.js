// Shared header/footer bits filled from config.json (written by `python run.py --channel finance site`).
const root = document.documentElement.dataset.root ?? ".";

fetch(`${root}/config.json`)
  .then((r) => r.json())
  .then((cfg) => {
    document.querySelectorAll("[data-youtube]").forEach((a) => {
      if (cfg.youtube_url) a.href = cfg.youtube_url;
      else a.remove();
    });
    document.querySelectorAll("[data-contact]").forEach((el) => {
      el.textContent = cfg.contact_email || "the contact address on our YouTube channel's About tab";
      if (cfg.contact_email && el.tagName === "A") el.href = `mailto:${cfg.contact_email}`;
    });
    const form = document.getElementById("newsletter");
    if (form && cfg.newsletter_signup_url) {
      form.action = cfg.newsletter_signup_url;
      form.hidden = false;
    }
  })
  .catch(() => {});

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
