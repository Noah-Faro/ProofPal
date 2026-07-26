/* global jest */

jest.mock('react-native-enriched-markdown', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { EnrichedMarkdownText: ({ markdown }) => React.createElement(Text, null, markdown) };
});
