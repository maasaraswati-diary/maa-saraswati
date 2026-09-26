import { useEffect, useRef } from 'react';
import Icon from './Icons';
import EnquiryForm from './EnquiryForm';
import { useScrollLock } from '../hooks';

/**
 * Slide-up enquiry dialog. Closes on the X, on a backdrop click, and on Escape.
 * Moves focus into the dialog on open and back to the trigger on close.
 */
export default function EnquiryModal({ open, onClose }) {
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);
  const restoreTo = useRef(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement;
    // Focus the name field so the customer can start typing straight away.
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector('input, textarea, select');
      el?.focus();
    }, 60);

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="enq-modal" role="dialog" aria-modal="true" aria-labelledby="enq-modal-title">
      <div className="enq-backdrop" onClick={onClose} />
      <div className="enq-panel" ref={panelRef}>
        <div className="enq-panel-head">
          <div className="enq-panel-titles">
            <span className="enq-panel-ic">
              <Icon.Mail size={20} />
            </span>
            <div>
              <h2 className="h3" id="enq-modal-title">
                Send us an enquiry
              </h2>
              <p className="muted" style={{ fontSize: '0.88rem' }}>
                We call back the same day, 6 AM – 9 PM.
              </p>
            </div>
          </div>
          <button className="enq-close" onClick={onClose} aria-label="Close enquiry form">
            <Icon.X size={20} />
          </button>
        </div>

        <div className="enq-panel-body">
          <EnquiryForm />
        </div>

        <div className="enq-panel-foot">
          <Icon.Phone size={16} />
          <span>
            Prefer to talk? <a href="tel:+919814391854">+91 98143 91854</a>
          </span>
          <a
            href="https://wa.me/919814391854"
            className="enq-panel-wa"
            target="_blank"
            rel="noreferrer"
          >
            <Icon.Whatsapp size={16} /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
