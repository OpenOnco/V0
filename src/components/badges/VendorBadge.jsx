import { VENDOR_BADGES } from '../../config/vendors';

// Helper to check if vendor has badges
export const getVendorBadges = (vendor) => {
  if (!vendor) return [];
  // Check exact match first
  if (VENDOR_BADGES[vendor]) return VENDOR_BADGES[vendor];
  // Check if vendor name contains a badge key
  for (const [key, badges] of Object.entries(VENDOR_BADGES)) {
    if (vendor.includes(key) || key.includes(vendor)) return badges;
  }
  return [];
};

// VendorBadge component - displays badges next to vendor name
const VendorBadge = ({ vendor, size = 'sm' }) => {
  const badges = getVendorBadges(vendor);
  if (badges.length === 0) return null;

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <>
      {badges.map(badge => (
        <span
          key={badge.id}
          className={`${sizeClasses[size]} cursor-help ml-1 inline-flex items-center`}
          title={badge.tooltip}
        >
          <span className="hover:scale-110 transition-transform">{badge.icon}</span>
        </span>
      ))}
    </>
  );
};

export default VendorBadge;
