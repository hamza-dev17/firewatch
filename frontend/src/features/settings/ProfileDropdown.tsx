import type { DemoRole } from "../../dashboard/types";

type ProfileDropdownProps = {
  role: DemoRole;
  onRoleChange: (role: DemoRole) => void;
};

export const ProfileDropdown = ({ role, onRoleChange }: ProfileDropdownProps) => (
  <section className="profile-dropdown" id="profile-dropdown" aria-label="Profile menu">
    <div className="profile-dropdown-header">
      <div className="profile-dropdown-avatar" aria-hidden="true">
        HK
      </div>
      <div className="profile-dropdown-identity">
        <div className="profile-dropdown-kicker">Authenticated operator</div>
        <div className="profile-dropdown-name">Hamza Karakus</div>
        <div className="profile-dropdown-email">hamza.karakus@ogm.gov.tr</div>
      </div>
      <span className="profile-dropdown-status" title="Session active">
        <i aria-hidden="true" />
        Online
      </span>
    </div>

    <div className="profile-dropdown-body">
      <label className="profile-dropdown-role">
        <span>Active demo role</span>
        <select
          aria-label="Demo role"
          value={role}
          onChange={(event) => onRoleChange(event.target.value as DemoRole)}
        >
          <option>Forest Officer</option>
          <option>Disaster Management Official</option>
        </select>
      </label>

      <div className="profile-dropdown-section-label">Operational assignment</div>
      <div className="profile-dropdown-grid">
        <div className="profile-dropdown-cell">
          <span>Region</span>
          <strong>AEGEAN / MEDITERRANEAN</strong>
        </div>
        <div className="profile-dropdown-cell">
          <span>Station</span>
          <strong>MUGLA OBM</strong>
        </div>
      </div>
    </div>

    <div className="profile-dropdown-footer">
      <div className="profile-dropdown-session">
        <span><i aria-hidden="true" /> Session active</span>
        <strong>PHASE TWO <em>DEMO</em></strong>
      </div>
      <button type="button">Sign out</button>
    </div>
  </section>
);
