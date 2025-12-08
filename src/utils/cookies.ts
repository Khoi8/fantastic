export function setCookie(name: string, value: string, days = 30) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

export function getCookie(name: string): string | null {
    const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
    if (!match) return null;
    return decodeURIComponent(match.split('=').slice(1).join('='));
}

export function deleteCookie(name: string) {
    setCookie(name, '', -1);
}
