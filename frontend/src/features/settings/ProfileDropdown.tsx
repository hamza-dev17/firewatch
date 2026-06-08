import type { DemoRole } from "../../dashboard/types";
import { DEFAULT_OPERATOR_PROFILE, getOperatorInitials, type OperatorProfile } from "./operatorProfile";

type ProfileDropdownProps = {
  role: DemoRole;
  onRoleChange: (role: DemoRole) => void;
  profile?: OperatorProfile;
};

export const ProfileDropdown = ({ role, onRoleChange, profile = DEFAULT_OPERATOR_PROFILE }: ProfileDropdownProps) => (
  <section className="profile-dropdown" id="profile-dropdown" aria-label="Profile menu">
    <div className="profile-dropdown-header">
      <div className="profile-dropdown-avatar" aria-hidden="true">
        {getOperatorInitials(profile.displayName)}
      </div>
      <div className="profile-dropdown-identity">
        <div className="profile-dropdown-kicker">Demo operator context</div>
        <div className="profile-dropdown-name">{profile.displayName}</div>
        <div className="profile-dropdown-email">{profile.email}</div>
      </div>
      <span className="profile-dropdown-status" title="Demo session active">
        <i aria-hidden="true" />
        Demo
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

      <div className="profile-dropdown-context" aria-label="Profile status">
        <div>
          <span>Identity mode</span>
          <strong>MVP demo</strong>
        </div>
        <div>
          <span>Access control</span>
          <strong>Phase two</strong>
        </div>
      </div>

      <div className="profile-dropdown-section-label">Operational assignment</div>
      <div className="profile-dropdown-grid">
        <div className="profile-dropdown-cell">
          <span>Region</span>
          <strong>{profile.region.toUpperCase()}</strong>
        </div>
        <div className="profile-dropdown-cell">
          <span>Station</span>
          <strong>{profile.station.toUpperCase()}</strong>
        </div>
      </div>
    </div>

    <div className="profile-dropdown-footer">
      <div className="profile-dropdown-session">
        <span><i aria-hidden="true" /> Demo session active</span>
        <strong>Profile is local <em>MVP</em></strong>
      </div>
      <button type="button" disabled>
        Sign out in phase two
      </button>
    </div>
  </section>
);
