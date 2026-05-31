import type { DemoRole } from "../../dashboard/types";

type ProfileDropdownProps = {
  role: DemoRole;
  onRoleChange: (role: DemoRole) => void;
};

export const ProfileDropdown = ({ role, onRoleChange }: ProfileDropdownProps) => (
  <section className="profile-dropdown" aria-label="Profile menu">
    <div className="profile-dropdown-header">
      <div className="profile-dropdown-avatar" aria-hidden="true">
        HK
      </div>
      <div>
        <div className="profile-dropdown-name">Hamza Karakus</div>
        <div className="profile-dropdown-email">hamza.karakus@ogm.gov.tr</div>
      </div>
    </div>

    <div className="profile-dropdown-body">
      <label className="profile-dropdown-role">
        <span>Demo role</span>
        <select value={role} onChange={(event) => onRoleChange(event.target.value as DemoRole)}>
          <option>Forest Officer</option>
          <option>Disaster Management Official</option>
        </select>
      </label>
      <div className="profile-dropdown-row">
        <span>Region</span>
        <strong>AEGEAN / MEDITERRANEAN</strong>
      </div>
      <div className="profile-dropdown-row">
        <span>Station</span>
        <strong>MUGLA OBM</strong>
      </div>
      <div className="profile-dropdown-row">
        <span>Session</span>
        <strong className="profile-dropdown-active">ACTIVE</strong>
      </div>
      <div className="profile-dropdown-row">
        <span>Auth</span>
        <strong>PHASE TWO <em>DEMO</em></strong>
      </div>
    </div>

    <div className="profile-dropdown-footer">
      <button type="button">Sign out</button>
    </div>
  </section>
);
