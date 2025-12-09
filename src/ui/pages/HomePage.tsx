import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserDataWithUserId, getUserDataWithUsername } from "../../api/main";
import { setCookie, getCookie } from "../../utils/cookies";
import LeaugePicker from "../components/LeaugePicker";

function HomePage() {
    const [userData, setUserData] = useState<any | null>(null);
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const id = getCookie('userId');
        if (id !== null) {
            setLoading(true);
            getUserDataWithUserId(id)
                .then((response) => setUserData(response.data))
                .catch(() => setError('Failed to load user data using stored id.'))
                .finally(() => setLoading(false));
        }
    }, []);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!username) {
            setError('Please enter a username.');
            return;
        }
        setLoading(true);
        try {
            const response = await getUserDataWithUsername(username);
            const data = response.data;
            const id = data?.id ?? data?.user_id ?? data?.userId ?? data?.uid;
            if (!id) {
                setError('User id not found in response.');
                return;
            }
            setCookie('userId', String(id), 30);
            setUserData(data);
        } catch (err) {
            setError('Lookup failed. Check the username or network.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>Home Page</h1>
            {loading && <p>Loading...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}

            {!userData ? (
                <form onSubmit={handleLookup}>
                    <label>
                        Username: <input value={username} onChange={(e) => setUsername(e.target.value)} />
                    </label>
                    <button type="submit">Lookup and Save</button>
                </form>
            ) : (
                <div>
                    <pre>{JSON.stringify(userData, null, 2)}</pre>
                    <h2>Your Leagues</h2>
                    <LeaugePicker onSelect={(league) => navigate(`/league/${league.league_id}`)} />
                </div>
            )}
        </div>
    );
}

export default HomePage;