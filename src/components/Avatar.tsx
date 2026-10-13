import { useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
}

export const Avatar = ({ uri, style }: AvatarProps) => {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  
  if (!uri || failedUri === uri) {
    return (
      <Image 
        source={require('../../assets/app-icon-v2.png')}
        style={style} 
      />
    );
  }

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      onError={() => setFailedUri(uri)}
    />
  );
};
