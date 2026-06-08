import { useEffect, useRef, useState, type ReactNode } from "react";

import type { DemoRole } from "../../dashboard/types";
import { getOperatorInitials, type OperatorProfile } from "./operatorProfile";

type ProfileModalProps = {
  onClose: () => void;
  profile: OperatorProfile;
  onSave: (profile: OperatorProfile) => void;
};

type Tab = "account" | "assignment" | "preferences" | "security";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "account", label: "Account", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id: "assignment", label: "Assignment", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
  { id: "preferences", label: "Preferences", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  { id: "security", label: "Security", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
];

export const ProfileModal = ({ onClose, profile, onSave }: ProfileModalProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [saved, setSaved] = useState(false);
  const [draftProfile, setDraftProfile] = useState<OperatorProfile>(profile);
  const overlayRef = useRef<HTMLDivElement>(null);

  const updateDraftProfile = <Key extends keyof OperatorProfile>(
    key: Key,
    value: OperatorProfile[Key]
  ) => {
    setDraftProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = () => {
    onSave(draftProfile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div
      className="profile-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Operator profile settings"
    >
      <div className="profile-modal">
        <aside className="profile-modal-sidebar">
          <div className="profile-modal-avatar-wrap">
            <div className="profile-modal-avatar-lg" aria-hidden="true">
              {getOperatorInitials(draftProfile.displayName)}
            </div>
            <div className="profile-modal-avatar-status" title="Online" />
            <button className="profile-modal-avatar-change" type="button" aria-label="Change photo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>

          <div className="profile-modal-sidebar-name">{draftProfile.displayName}</div>
          <div className="profile-modal-sidebar-role">{draftProfile.role}</div>
          <div className="profile-modal-sidebar-badge">
            <span className="profile-modal-sidebar-badge-dot" />
            {draftProfile.badge}
          </div>

          <nav className="profile-modal-nav" aria-label="Profile sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`profile-modal-nav-btn${activeTab === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                <span className="profile-modal-nav-icon" aria-hidden="true">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="profile-modal-sidebar-footer">
            <div className="profile-modal-session-dot" />
            <span>Session active</span>
          </div>
        </aside>

        <main className="profile-modal-main">
          <div className="profile-modal-topbar">
            <h2 className="profile-modal-title">
              {TABS.find((tab) => tab.id === activeTab)?.label}
            </h2>
            <button className="profile-modal-close" type="button" onClick={onClose} aria-label="Close profile">
              x
            </button>
          </div>

          {activeTab === "account" && (
            <div className="profile-modal-section">
              <p className="profile-modal-section-desc">
                Your personal information as recorded in the FIREWATCH operator registry.
              </p>

              <div className="profile-modal-field-group two-col">
                <label className="profile-modal-field">
                  <span>Full name</span>
                  <input
                    type="text"
                    value={draftProfile.displayName}
                    onChange={(e) => updateDraftProfile("displayName", e.target.value)}
                    placeholder="Full name"
                  />
                </label>
                <label className="profile-modal-field">
                  <span>Badge / ID</span>
                  <input
                    type="text"
                    value={draftProfile.badge}
                    onChange={(e) => updateDraftProfile("badge", e.target.value)}
                    placeholder="OGM-0000"
                  />
                </label>
              </div>

              <label className="profile-modal-field">
                <span>Work email</span>
                <input
                  type="email"
                  value={draftProfile.email}
                  onChange={(e) => updateDraftProfile("email", e.target.value)}
                  placeholder="name@ogm.gov.tr"
                />
              </label>

              <label className="profile-modal-field">
                <span>Phone (operational contact)</span>
                <input
                  type="tel"
                  value={draftProfile.phone}
                  onChange={(e) => updateDraftProfile("phone", e.target.value)}
                  placeholder="+90 ..."
                />
              </label>

              <label className="profile-modal-field">
                <span>Bio / Notes</span>
                <textarea
                  rows={3}
                  value={draftProfile.bio}
                  onChange={(e) => updateDraftProfile("bio", e.target.value)}
                  placeholder="Short description of your role and area of responsibility..."
                />
              </label>

              <div className="profile-modal-info-strip">
                <span className="pmi-label">Identity mode</span>
                <span className="pmi-value">MVP Demo</span>
                <span className="pmi-sep" />
                <span className="pmi-label">Access control</span>
                <span className="pmi-value">Phase Two</span>
              </div>
            </div>
          )}

          {activeTab === "assignment" && (
            <div className="profile-modal-section">
              <p className="profile-modal-section-desc">
                Operational assignment and active role within the FIREWATCH DSS.
              </p>

              <label className="profile-modal-field">
                <span>Active role</span>
                <select
                  value={draftProfile.role}
                  onChange={(e) => updateDraftProfile("role", e.target.value as DemoRole)}
                >
                  <option>Forest Officer</option>
                  <option>Disaster Management Official</option>
                </select>
              </label>

              <div className="profile-modal-field-group two-col">
                <label className="profile-modal-field">
                  <span>Region</span>
                  <select value={draftProfile.region} onChange={(e) => updateDraftProfile("region", e.target.value)}>
                    <option>Aegean / Mediterranean</option>
                    <option>Marmara</option>
                    <option>Black Sea</option>
                    <option>Central Anatolia</option>
                    <option>Eastern Anatolia</option>
                    <option>South-Eastern Anatolia</option>
                  </select>
                </label>
                <label className="profile-modal-field">
                  <span>Station</span>
                  <select value={draftProfile.station} onChange={(e) => updateDraftProfile("station", e.target.value)}>
                    <option>Mugla OBM</option>
                    <option>Izmir OBM</option>
                    <option>Antalya OBM</option>
                    <option>Adana OBM</option>
                    <option>Ankara OBM</option>
                    <option>Bursa OBM</option>
                  </select>
                </label>
              </div>

              <label className="profile-modal-field">
                <span>Shift</span>
                <select value={draftProfile.shift} onChange={(e) => updateDraftProfile("shift", e.target.value)}>
                  <option>Day Shift (06:00 - 18:00)</option>
                  <option>Night Shift (18:00 - 06:00)</option>
                  <option>24/7 Standby</option>
                  <option>Administrative (09:00 - 17:00)</option>
                </select>
              </label>

              <div className="profile-modal-assignment-card">
                <div className="pma-row">
                  <div className="pma-cell">
                    <span>Region</span>
                    <strong>{draftProfile.region}</strong>
                  </div>
                  <div className="pma-cell">
                    <span>Station</span>
                    <strong>{draftProfile.station}</strong>
                  </div>
                  <div className="pma-cell">
                    <span>Shift</span>
                    <strong>{draftProfile.shift}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="profile-modal-section">
              <p className="profile-modal-section-desc">
                Display, language, and notification settings.
              </p>

              <div className="profile-modal-field-group two-col">
                <label className="profile-modal-field">
                  <span>Language</span>
                  <select value={draftProfile.language} onChange={(e) => updateDraftProfile("language", e.target.value)}>
                    <option>English</option>
                    <option>Turkish</option>
                    <option>Arabic</option>
                  </select>
                </label>
                <label className="profile-modal-field">
                  <span>Timezone</span>
                  <select value={draftProfile.timezone} onChange={(e) => updateDraftProfile("timezone", e.target.value)}>
                    <option>Europe/Istanbul (UTC+3)</option>
                    <option>UTC+0</option>
                    <option>Europe/London (UTC+1)</option>
                    <option>Asia/Riyadh (UTC+3)</option>
                  </select>
                </label>
              </div>

              <label className="profile-modal-field">
                <span>Map auto-refresh interval (seconds)</span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={draftProfile.autoRefresh}
                  onChange={(e) => updateDraftProfile("autoRefresh", Number(e.target.value))}
                />
              </label>

              <div className="profile-modal-toggle-group">
                <div className="profile-modal-section-label">Alerts &amp; notifications</div>

                <label className="profile-modal-toggle">
                  <div className="toggle-info">
                    <span className="toggle-title">Alert sound</span>
                    <span className="toggle-desc">Play audio on high-risk predictions</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftProfile.alertSound}
                    className={`toggle-switch${draftProfile.alertSound ? " on" : ""}`}
                    onClick={() => updateDraftProfile("alertSound", !draftProfile.alertSound)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>

                <label className="profile-modal-toggle">
                  <div className="toggle-info">
                    <span className="toggle-title">Email alerts</span>
                    <span className="toggle-desc">Send critical fire risk reports by email</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftProfile.emailAlerts}
                    className={`toggle-switch${draftProfile.emailAlerts ? " on" : ""}`}
                    onClick={() => updateDraftProfile("emailAlerts", !draftProfile.emailAlerts)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>

                <label className="profile-modal-toggle">
                  <div className="toggle-info">
                    <span className="toggle-title">SMS alerts</span>
                    <span className="toggle-desc">Receive critical alerts via SMS</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftProfile.smsAlerts}
                    className={`toggle-switch${draftProfile.smsAlerts ? " on" : ""}`}
                    onClick={() => updateDraftProfile("smsAlerts", !draftProfile.smsAlerts)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>

                <label className="profile-modal-toggle">
                  <div className="toggle-info">
                    <span className="toggle-title">High-contrast map</span>
                    <span className="toggle-desc">Enhanced colour differentiation for risk layers</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draftProfile.highContrastMap}
                    className={`toggle-switch${draftProfile.highContrastMap ? " on" : ""}`}
                    onClick={() => updateDraftProfile("highContrastMap", !draftProfile.highContrastMap)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="profile-modal-section">
              <p className="profile-modal-section-desc">
                Authentication and access log. Full auth is enabled in Phase Two.
              </p>

              <div className="profile-modal-security-info">
                <div className="psi-row">
                  <span className="psi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                  </span>
                  <div>
                    <div className="psi-title">Password</div>
                    <div className="psi-sub">Last changed: <em>Phase Two</em></div>
                  </div>
                  <button type="button" className="psi-action" disabled>Change password</button>
                </div>
                <div className="psi-row">
                  <span className="psi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  </span>
                  <div>
                    <div className="psi-title">Two-factor authentication</div>
                    <div className="psi-sub">Status: <em>Not configured</em></div>
                  </div>
                  <button type="button" className="psi-action" disabled>Set up 2FA</button>
                </div>
                <div className="psi-row">
                  <span className="psi-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </span>
                  <div>
                    <div className="psi-title">Active sessions</div>
                    <div className="psi-sub">1 session - This device</div>
                  </div>
                  <button type="button" className="psi-action" disabled>Revoke others</button>
                </div>
              </div>

              <div className="profile-modal-section-label" style={{ marginTop: 24 }}>
                Recent access log
              </div>
              <div className="profile-modal-log">
                {[
                  { time: "Today, 19:12", event: "Session started", device: "Chrome - Windows" },
                  { time: "Today, 06:48", event: "Map layer changed", device: "Chrome - Windows" },
                  { time: "Yesterday, 22:31", event: "Prediction run", device: "Chrome - Windows" },
                  { time: "Yesterday, 18:00", event: "Session ended", device: "Chrome - Windows" },
                ].map((entry) => (
                  <div key={`${entry.time}-${entry.event}`} className="profile-modal-log-row">
                    <span className="pml-time">{entry.time}</span>
                    <span className="pml-event">{entry.event}</span>
                    <span className="pml-device">{entry.device}</span>
                  </div>
                ))}
              </div>

              <button type="button" className="profile-modal-danger-btn" disabled>
                Sign out of all sessions
              </button>
            </div>
          )}

          <div className="profile-modal-footer">
            <button type="button" className="pmf-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={`pmf-save${saved ? " saved" : ""}`} onClick={handleSave}>
              {saved ? "Saved" : "Save changes"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
