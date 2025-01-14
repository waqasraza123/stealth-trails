import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const fetchUser = async (userId: string) => {
  const authToken = localStorage.getItem('authToken');
  if (!authToken) {
    throw new Error('User is not authenticated.');
  }

  const serverUrl = import.meta.env.VITE_SERVER_URL;
  const response = await axios.get(`${serverUrl}/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const userData = response.data.data;
  const { ethereumAddress, ...cacheableData } = userData;
  localStorage.setItem('user', JSON.stringify(cacheableData));

  return userData;
};

export const useGetUser = (userId: string) => {
  const { data: user, isLoading, isError, error } = useQuery({queryKey: [userId], queryFn: () => fetchUser(userId)});

  return { user, loading: isLoading, error: isError ? error.message : null };
};
