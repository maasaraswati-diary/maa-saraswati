import { useState } from 'react';
import Icon from './Icons';
import EnquiryModal from './EnquiryModal';

/**
 * Floating enquiry button, shown on every public page. Sits bottom-left so it
 * never collides with the back-to-top button (bottom-right) or toasts.
 */
export default function EnquiryFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="enq-fab"
        onClick={() => setOpen(true)}
        aria-label="Open enquiry form"
        aria-haspopup="dialog"
      >
        <span className="enq-fab-ic">
          <Icon.Mail size={20} />
        </span>
        <span className="enq-fab-label">Enquiry</span>
      </button>

      <EnquiryModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
