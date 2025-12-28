import { getProductTypeConfig } from '../../data';

// Product Type Badge Component
const ProductTypeBadge = ({ productType, size = 'sm' }) => {
  const config = getProductTypeConfig(productType);
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} ${config.bgColor} ${config.textColor} border ${config.borderColor} rounded-full font-medium`}
      title={config.description}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};

export default ProductTypeBadge;
