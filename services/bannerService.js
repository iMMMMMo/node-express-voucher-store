const BannerModel = require("../models/bannerModel");

const normalizeBannerLink = (value) => {
  const link = (value ?? "").toString().trim();
  if (!link) return null;
  if (link.startsWith("/")) return link;
  if (/^https?:\/\//i.test(link)) return link;
  return null;
};

const getActiveBannersForHomepage = async () => {
  const banners = await BannerModel.findActiveForHomepage();

  return (banners || []).map((b) => ({
    id: b.id,
    imagePath: b.imagePath || null,
    caption: b.caption || null,
    content: b.content || null,
    button: b.button || null,
    link: normalizeBannerLink(b.link),
  }));
};

module.exports = {
  getActiveBannersForHomepage,
};
