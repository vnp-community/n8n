declare module 'psl' {
	export interface ParsedDomain {
		domain: string | null;
		sld: string | null;
		tld: string | null;
		subdomain: string | null;
		listed: boolean;
	}

	export function parse(domain: string): ParsedDomain;
	export function get(domain: string): string | null;
	export function isValid(domain: string): boolean;
}
