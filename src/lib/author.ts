export interface Author {

    slug: string;

    name: string;

    title: string;

    bio: string;

    avatar: string;

    email?: string;

    website?: string;

    github?: string;

    linkedin?: string;

    x?: string;

}

export const AUTHORS: Record<string, Author> = {

    "israel-alabi": {

        slug: "israel-alabi",

        name: "Israel Alabi",

        title: "Founder & Editor-in-Chief",

        bio: "Israel Alabi is the Founder and Editor-in-Chief of The Technology Joint. He writes practical, research-driven articles covering cybersecurity, artificial intelligence, software, consumer technology, SEO and digital growth. His mission is to make complex technology understandable and useful for professionals, businesses and everyday users.",

        avatar: "/images/founder.jpg",

        email: "israel.alabi.seo@gmail.com",

        github: "https://github.com/",

        linkedin: "https://linkedin.com/",

        x: "https://x.com/",

    },

};

export function slugifyAuthor(name: string): string {

    return name

        .trim()

        .toLowerCase()

        .replace(/[^a-z0-9]+/g, "-")

        .replace(/(^-|-$)/g, "");

}

export function getAuthor(name: string): Author {

    const slug = slugifyAuthor(name);

    return (

        AUTHORS[slug] ?? {

            slug,

            name,

            title: "Contributor",

            bio: "Contributor to The Technology Joint.",

            avatar: "/images/founder.jpg",

        }

    );

}

export function getAllAuthors(): Author[] {

    return Object.values(AUTHORS);

}