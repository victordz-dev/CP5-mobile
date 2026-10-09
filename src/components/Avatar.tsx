import { useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
}

export const Avatar = ({ uri, style }: AvatarProps) => {
  const [error, setError] = useState(false);
  
  if (!uri || error) {
    return (
      <Image 
        source={require('../../assets/icon.png')} 
        style={style} 
      />
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      onError={() => setError(true)} 
    />
  );
};
