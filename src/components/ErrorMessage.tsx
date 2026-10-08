import { View, Text, StyleSheet } from 'react-native';

export const ErrorMessage = ({ message }: { message: string }) => {
  if (!message) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#ffcccc',
    borderRadius: 5,
    marginVertical: 10,
  },
  text: {
    color: '#cc0000',
    textAlign: 'center',
  },
});
