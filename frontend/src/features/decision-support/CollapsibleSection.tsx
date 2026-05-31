import { useId, useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  children: ReactNode;
  title: string;
};

export const CollapsibleSection = ({ children, title }: CollapsibleSectionProps) => {
  const contentId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="collapsible-section">
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        aria-label={title}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span>{title}</span>
        <i aria-hidden="true" className={isOpen ? "" : "collapsed"}>v</i>
      </button>
      <div aria-label={title} className="collapsible-section-content" hidden={!isOpen} id={contentId} role="region">
        {children}
      </div>
    </section>
  );
};
