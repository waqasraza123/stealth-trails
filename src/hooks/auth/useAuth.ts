import { useState } from "react";
import axios from "axios";

const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signup = async (data: { firstName: string; lastName: string; email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
        const serverUrl = import.meta.env.VITE_SERVER_URL;
      const response = await axios.post(serverUrl + "/auth/signup", data);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
        const serverUrl = import.meta.env.VITE_SERVER_URL;
        const response = await axios.post(serverUrl + "/auth/login", data);
        return response.data;
    } catch (err: any) {
        setError(err.response?.data?.message || "An error occurred");
        throw err;
    } finally {
        setLoading(false);
    }
  };

  return { signup, login, loading, error };
};

export default useAuth;
