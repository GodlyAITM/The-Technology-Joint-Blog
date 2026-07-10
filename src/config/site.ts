export const SITE = {
    name: "The Technology Joint",

    shortName: "TTJ",

    title: "The Technology Joint",

    description:
        "Practical technology journalism covering AI, cybersecurity, software, SEO, consumer technology and digital growth.",

    language: "en",

    author: "The Technology Joint",

    email: "israel.alabi.seo@gmail.com",

    url:
        import.meta.env.PUBLIC_SITE_URL ??
        "http://localhost:4321",

    logo: "/images/logo.png",

    defaultHero: "/images/default-hero.jpg",

    copyright:
        `© ${new Date().getFullYear()} The Technology Joint`,

    social: {

        github: "",

        linkedin: "",

        x: "",

        facebook: "",

        youtube: "",

        instagram: ""

    }

};

export type SiteConfig = typeof SITE;