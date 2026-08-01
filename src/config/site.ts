export const SITE = {
    name: "The Technology Joint",

    shortName: "TTJ",

    title: "The Technology Joint",

    description:
        "Practical technology journalism covering AI, cybersecurity, software, SEO, consumer technology and digital growth.",

    language: "en",

    author: "Israel Alabi",

    email: "israel.alabi.seo@gmail.com",

    url:
        import.meta.env.PUBLIC_SITE_URL?.trim() ||
        "http://localhost:4321",

    logo: `${import.meta.env.BASE_URL}images/logo.jpg`,

    defaultHero: "/images/default-hero.jpg",

    founderImage: `${import.meta.env.BASE_URL}images/founder.jpg`,
    copyright:
        `© ${new Date().getFullYear()} The Technology Joint`,

    social: {
        github: "",
        linkedin: "",
        x: "",
        facebook: "",
        youtube: "",
        instagram: "",
    },
};

export type SiteConfig = typeof SITE;