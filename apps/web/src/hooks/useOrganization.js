export default function useOrganization() {
    function get() {
        try {
            const raw = localStorage.getItem('org');
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    function set(org) {
        localStorage.setItem('org', JSON.stringify(org));
    }
    return { get, set };
}
