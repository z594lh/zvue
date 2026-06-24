<template>
  <div class="company-page">
    <header class="site-header">
      <div class="container header-inner">
        <div class="brand">
          <span class="brand-mark">QF</span>
          <div class="brand-text">
            <span class="brand-name">{{ t.brandName }}</span>
            <span class="brand-en">{{ t.brandEn }}</span>
          </div>
        </div>
        <nav class="site-nav">
          <a href="#about">{{ t.nav.about }}</a>
          <a href="#business">{{ t.nav.business }}</a>
          <a href="#supply">{{ t.nav.supply }}</a>
          <a href="#contact">{{ t.nav.contact }}</a>
        </nav>
        <div class="header-actions">
          <div class="lang-switch">
            <button :class="{ active: lang === 'zh' }" @click="setLang('zh')">中文</button>
            <button :class="{ active: lang === 'en' }" @click="setLang('en')">EN</button>
          </div>
          <router-link class="btn-login" to="/login">{{ t.erpLogin }}</router-link>
        </div>
      </div>
    </header>

    <section class="hero">
      <div class="container hero-inner">
        <h1>{{ t.hero.title1 }}<br />{{ t.hero.title2 }}</h1>
        <p class="hero-sub">{{ t.hero.sub }}</p>
        <div class="hero-actions">
          <a class="btn-primary" href="#business">{{ t.hero.btnPrimary }}</a>
          <a class="btn-ghost" href="#contact">{{ t.hero.btnGhost }}</a>
        </div>
      </div>
    </section>

    <section id="about" class="section">
      <div class="container">
        <div class="section-head">
          <h2>{{ t.about.heading }}</h2>
          <span class="section-line"></span>
        </div>
        <p class="lead">{{ t.about.lead }}</p>
        <div class="stat-grid">
          <div v-for="(s, i) in t.about.stats" :key="i" class="stat-card">
            <span class="stat-num" v-html="s.num"></span>
            <span class="stat-label">{{ s.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <section id="business" class="section section-alt">
      <div class="container">
        <div class="section-head">
          <h2>{{ t.business.heading }}</h2>
          <span class="section-line"></span>
        </div>
        <div class="card-grid">
          <div v-for="(c, i) in t.business.cards" :key="i" class="biz-card">
            <div class="biz-icon">{{ c.icon }}</div>
            <h3>{{ c.title }}</h3>
            <p>{{ c.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section id="supply" class="section">
      <div class="container">
        <div class="section-head">
          <h2>{{ t.supply.heading }}</h2>
          <span class="section-line"></span>
        </div>
        <div class="supply-grid">
          <div v-for="(item, i) in t.supply.items" :key="i" class="supply-item">
            <span class="supply-no">{{ item.no }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section id="contact" class="section section-dark">
      <div class="container">
        <div class="section-head light">
          <h2>{{ t.contact.heading }}</h2>
          <span class="section-line"></span>
        </div>
        <div class="contact-grid">
          <div v-for="(item, i) in t.contact.items" :key="i" class="contact-item">
            <span class="contact-label">{{ item.label }}</span>
            <span class="contact-value">{{ item.value }}</span>
          </div>
        </div>
        <div class="contact-cta">
          <span>{{ t.contact.ctaText }}</span>
          <router-link class="btn-primary" to="/login">{{ t.erpLogin }}</router-link>
        </div>
      </div>
    </section>

    <footer class="site-footer">
      <div class="container footer-inner">
        <span>© {{ year }} {{ t.footer.copyright }}</span>
        <span class="footer-sub">{{ t.footer.sub }}</span>
      </div>
    </footer>
  </div>
</template>

<script>
const messages = {
  zh: {
    brandName: '瑞金市勤发跨境电子商务有限责任公司',
    brandEn: 'RUIJIN QINFA CROSS-BORDER E-COMMERCE CO., LTD.',
    erpLogin: 'ERP 登录',
    nav: { about: '公司简介', business: '主营业务', supply: '供应链优势', contact: '联系我们' },
    hero: {
      title1: '专注跨境电商',
      title2: '连接中国工厂与全球买家',
      sub: '依托工厂格子供应链渠道，提供从选品、采购、备货到跨境履约的一站式电商服务，助力优质中国制造高效出海。',
      btnPrimary: '了解业务',
      btnGhost: '商务合作'
    },
    about: {
      heading: '公司简介',
      lead: '瑞金市勤发跨境电子商务有限责任公司是一家专注于跨境电子商务的现代化企业，主营业务覆盖跨境零售与批发，深耕亚马逊等主流跨境电商平台。公司整合上游工厂资源，搭建稳定高效的供应链体系，致力于将高性价比的中国商品销往全球市场。',
      stats: [
        { num: '100<i>+</i>', label: '合作工厂资源' },
        { num: '10<i>+</i>', label: '覆盖海外站点' },
        { num: '7<i>×</i>24', label: '订单履约保障' },
        { num: '全品类', label: '选品供应能力' }
      ]
    },
    business: {
      heading: '主营业务',
      cards: [
        { icon: '🛒', title: '跨境电商零售', desc: '在亚马逊等主流平台运营自营店铺，覆盖多品类商品，面向全球消费者销售。' },
        { icon: '🏭', title: '工厂供应链', desc: '对接源头工厂，依托工厂格子供应链渠道，实现稳定货源与高性价比采购。' },
        { icon: '📦', title: '仓储与备货', desc: '提供智能备货看板与库存管理，保障旺季供货充足、周转高效。' },
        { icon: '🚚', title: '跨境物流履约', desc: '整合头程货代与海外仓资源，提供从国内到海外消费者的全链路履约服务。' },
        { icon: '📈', title: '数据化运营', desc: '以数据驱动选品、定价与广告投放，持续提升店铺经营效率与利润。' },
        { icon: '🤝', title: '品牌出海服务', desc: '为合作伙伴提供选品、运营与渠道支持，助力中国品牌走向全球。' }
      ]
    },
    supply: {
      heading: '供应链优势',
      items: [
        { no: '01', title: '工厂格子直采渠道', desc: '通过工厂格子供应链渠道直连产业带源头工厂，砍掉中间环节，价格更具竞争力。' },
        { no: '02', title: '柔性供货能力', desc: '支持小单快返与批量备货，灵活应对跨境电商需求波动与新品快速测试。' },
        { no: '03', title: '品控与交付保障', desc: '建立标准化质检与发货流程，保障商品品质稳定、交付及时。' },
        { no: '04', title: '全链路数字化', desc: '采购、库存、物流、报表全流程线上化管理，提升整体运营透明度与效率。' }
      ]
    },
    contact: {
      heading: '联系我们',
      items: [
        { label: '公司名称', value: '瑞金市勤发跨境电子商务有限责任公司' },
        { label: '公司地址', value: '江西省赣州市瑞金市' },
        { label: '商务邮箱', value: 'business@qinfa-ecommerce.com' },
        { label: '合作方向', value: '工厂供应 · 跨境电商运营 · 渠道合作' }
      ],
      ctaText: '已是合作伙伴或公司员工？'
    },
    footer: {
      copyright: '瑞金市勤发跨境电子商务有限责任公司 保留所有权利',
      sub: '专注跨境电商 · 工厂供应链 · 品牌出海'
    }
  },
  en: {
    brandName: 'RUIJIN QINFA CROSS-BORDER E-COMMERCE CO., LTD.',
    brandEn: '瑞金市勤发跨境电子商务有限责任公司',
    erpLogin: 'ERP Login',
    nav: { about: 'About', business: 'Business', supply: 'Supply Chain', contact: 'Contact' },
    hero: {
      title1: 'Focused on Cross-border E-commerce',
      title2: 'Connecting Chinese Factories with Global Buyers',
      sub: 'Backed by our factory-grid supply chain, we deliver one-stop e-commerce services covering product selection, sourcing, stocking and cross-border fulfillment, helping quality China-made goods reach the world.',
      btnPrimary: 'Our Business',
      btnGhost: 'Partner With Us'
    },
    about: {
      heading: 'About Us',
      lead: 'Ruijin Qinfa Cross-border E-commerce Co., Ltd. is a modern enterprise focused on cross-border e-commerce, covering both retail and wholesale across mainstream platforms such as Amazon. By integrating upstream factory resources and building a stable, efficient supply chain, we are committed to bringing cost-effective Chinese products to the global market.',
      stats: [
        { num: '100<i>+</i>', label: 'Partner Factories' },
        { num: '10<i>+</i>', label: 'Overseas Marketplaces' },
        { num: '7<i>×</i>24', label: 'Fulfillment Support' },
        { num: 'All', label: 'Category Sourcing' }
      ]
    },
    business: {
      heading: 'Core Business',
      cards: [
        { icon: '🛒', title: 'Cross-border Retail', desc: 'Operating self-run stores on mainstream platforms like Amazon, selling multi-category products to consumers worldwide.' },
        { icon: '🏭', title: 'Factory Supply Chain', desc: 'Connecting directly with source factories through our factory-grid channel for stable supply and competitive pricing.' },
        { icon: '📦', title: 'Warehousing & Stocking', desc: 'Smart stocking dashboards and inventory management ensure ample supply and efficient turnover during peak seasons.' },
        { icon: '🚚', title: 'Cross-border Fulfillment', desc: 'Integrating freight forwarders and overseas warehouses for end-to-end delivery from China to global customers.' },
        { icon: '📈', title: 'Data-driven Operations', desc: 'Data drives product selection, pricing and advertising to continuously improve store performance and profit.' },
        { icon: '🤝', title: 'Brand Globalization', desc: 'Providing selection, operation and channel support to help Chinese brands expand globally.' }
      ]
    },
    supply: {
      heading: 'Supply Chain Advantages',
      items: [
        { no: '01', title: 'Direct Factory-grid Sourcing', desc: 'Direct access to source factories in industrial belts cuts out the middlemen for more competitive prices.' },
        { no: '02', title: 'Flexible Supply Capacity', desc: 'Quick small-batch replenishment and bulk stocking flexibly handle demand fluctuations and new-product testing.' },
        { no: '03', title: 'Quality & Delivery Assurance', desc: 'Standardized inspection and shipping processes ensure stable quality and on-time delivery.' },
        { no: '04', title: 'End-to-end Digitalization', desc: 'Sourcing, inventory, logistics and reporting are fully managed online for greater transparency and efficiency.' }
      ]
    },
    contact: {
      heading: 'Contact Us',
      items: [
        { label: 'Company', value: 'Ruijin Qinfa Cross-border E-commerce Co., Ltd.' },
        { label: 'Address', value: 'Ruijin, Ganzhou, Jiangxi, China' },
        { label: 'Business Email', value: 'business@qinfa-ecommerce.com' },
        { label: 'Cooperation', value: 'Factory Supply · E-commerce Operation · Channel Partnership' }
      ],
      ctaText: 'Already a partner or staff member?'
    },
    footer: {
      copyright: 'Ruijin Qinfa Cross-border E-commerce Co., Ltd. All rights reserved.',
      sub: 'Cross-border E-commerce · Factory Supply Chain · Brand Globalization'
    }
  }
}

export default {
  name: 'CompanyView',
  data() {
    return {
      year: new Date().getFullYear(),
      lang: localStorage.getItem('company_lang') === 'en' ? 'en' : 'zh'
    }
  },
  computed: {
    t() {
      return messages[this.lang]
    }
  },
  methods: {
    setLang(lang) {
      this.lang = lang
      localStorage.setItem('company_lang', lang)
      document.title = this.t.brandName
    }
  },
  mounted() {
    document.title = this.t.brandName
  }
}
</script>

<style scoped>
.company-page {
  color: #1f2933;
  background: #ffffff;
  min-height: 100vh;
}

.container {
  width: 100%;
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 24px;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #eef0f3;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb, #1e40af);
  color: #fff;
  font-weight: 700;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.brand-en {
  font-size: 11px;
  color: #94a3b8;
  letter-spacing: 0.5px;
}

.site-nav {
  display: flex;
  gap: 26px;
  margin-left: auto;
}

.site-nav a {
  color: #475569;
  text-decoration: none;
  font-size: 15px;
  transition: color 0.2s;
}

.site-nav a:hover {
  color: #2563eb;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.lang-switch {
  display: inline-flex;
  border: 1px solid #d6dbe2;
  border-radius: 8px;
  overflow: hidden;
}

.lang-switch button {
  border: none;
  background: #fff;
  color: #64748b;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-switch button.active {
  background: #2563eb;
  color: #fff;
}

.btn-login {
  display: inline-block;
  padding: 9px 20px;
  border-radius: 8px;
  background: #0f172a;
  color: #fff;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-login:hover {
  background: #1e293b;
}

.hero {
  background: radial-gradient(circle at 20% 20%, #1e3a8a 0%, #0f172a 60%);
  color: #fff;
  padding: 110px 0 120px;
}

.hero-inner {
  text-align: center;
}

.hero h1 {
  font-size: 44px;
  line-height: 1.25;
  font-weight: 800;
  margin-bottom: 24px;
}

.hero-sub {
  max-width: 720px;
  margin: 0 auto 36px;
  font-size: 18px;
  line-height: 1.8;
  color: #cbd5e1;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn-primary,
.btn-ghost {
  display: inline-block;
  padding: 13px 34px;
  border-radius: 8px;
  font-size: 16px;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-primary:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
}

.btn-ghost {
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: #fff;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.1);
}

.section {
  padding: 90px 0;
}

.section-alt {
  background: #f8fafc;
}

.section-dark {
  background: #0f172a;
  color: #e2e8f0;
}

.section-head {
  margin-bottom: 48px;
}

.section-head h2 {
  font-size: 30px;
  font-weight: 700;
  color: #0f172a;
}

.section-head.light h2 {
  color: #fff;
}

.section-line {
  display: block;
  width: 56px;
  height: 4px;
  border-radius: 2px;
  background: #2563eb;
  margin-top: 14px;
}

.lead {
  font-size: 17px;
  line-height: 1.9;
  color: #475569;
  max-width: 880px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-top: 48px;
}

.stat-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 28px 20px;
  text-align: center;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.stat-num {
  display: block;
  font-size: 34px;
  font-weight: 800;
  color: #2563eb;
}

.stat-num i {
  font-style: normal;
  font-size: 22px;
}

.stat-label {
  display: block;
  margin-top: 8px;
  color: #64748b;
  font-size: 15px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.biz-card {
  background: #fff;
  border: 1px solid #eef0f3;
  border-radius: 14px;
  padding: 32px 28px;
  transition: all 0.25s;
}

.biz-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  border-color: #dbeafe;
}

.biz-icon {
  font-size: 34px;
  margin-bottom: 16px;
}

.biz-card h3 {
  font-size: 19px;
  margin-bottom: 12px;
  color: #0f172a;
}

.biz-card p {
  color: #64748b;
  line-height: 1.8;
  font-size: 15px;
}

.supply-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 28px;
}

.supply-item {
  padding: 28px 28px 28px 30px;
  border-left: 4px solid #2563eb;
  background: #f8fafc;
  border-radius: 0 12px 12px 0;
}

.supply-no {
  font-size: 26px;
  font-weight: 800;
  color: #93c5fd;
}

.supply-item h3 {
  margin: 8px 0 12px;
  font-size: 20px;
  color: #0f172a;
}

.supply-item p {
  color: #64748b;
  line-height: 1.85;
  font-size: 15px;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.contact-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.contact-label {
  font-size: 14px;
  color: #94a3b8;
}

.contact-value {
  font-size: 17px;
  color: #f1f5f9;
  font-weight: 600;
}

.contact-cta {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 40px;
  padding-top: 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 16px;
}

.site-footer {
  background: #0b1220;
  color: #94a3b8;
  padding: 28px 0;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
}

.footer-sub {
  color: #64748b;
}

@media (max-width: 980px) {
  .site-nav {
    display: none;
  }
  .brand-name {
    font-size: 13px;
  }
  .hero h1 {
    font-size: 32px;
  }
  .stat-grid,
  .card-grid,
  .supply-grid,
  .contact-grid {
    grid-template-columns: 1fr;
  }
}
</style>
