import { getSiteConfig, DOMAINS, BUILD_INFO } from '../data';

const Footer = () => {
  const siteConfig = getSiteConfig();

  const disclaimers = {
    [DOMAINS.ONCO]: `OpenOnco is provided for informational and educational purposes only. The information on this website is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition or treatment options. OpenOnco does not recommend or endorse any specific tests, physicians, products, procedures, or opinions. Nothing on this website constitutes reimbursement or coverage guidance, and should not be used to determine insurance coverage, patient financial responsibility, or billing practices. Reliance on any information provided by OpenOnco is solely at your own risk. Test performance data, pricing, and availability are subject to change and should be verified directly with test vendors.`,
    [DOMAINS.ALZ]: `OpenAlz is provided for informational and educational purposes only. The information on this website is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding Alzheimer's disease, cognitive symptoms, or treatment options. OpenAlz does not recommend or endorse any specific tests, physicians, products, procedures, or opinions. Nothing on this website constitutes reimbursement or coverage guidance, and should not be used to determine insurance coverage, patient financial responsibility, or billing practices. Reliance on any information provided by OpenAlz is solely at your own risk. Test performance data, pricing, and availability are subject to change and should be verified directly with test vendors.`,
  };

  return (
    <footer className="border-t border-gray-200 py-8 mt-12 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-sm text-gray-500 leading-relaxed text-justify">
          <strong>Disclaimer:</strong> {disclaimers[siteConfig.domain]}
        </p>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Built: {BUILD_INFO.date}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
