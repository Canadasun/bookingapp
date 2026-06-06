// Shared, presentational building blocks used across screens.
import React, { Component } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from './styles';

// ── Error Boundary ────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; error?: Error }
export class ErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', padding:28, backgroundColor:'#F8F9FA' }}>
        <View style={{ width:60, height:60, borderRadius:30, backgroundColor:'#FEF2F2', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
          <Text style={{ fontSize:28 }}>⚠️</Text>
        </View>
        <Text style={{ fontSize:18, fontWeight:'700', color:'#111827', marginBottom:8, textAlign:'center' }}>Something went wrong</Text>
        <Text style={{ fontSize:13, color:'#6B7280', textAlign:'center', marginBottom:24 }}>
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor:'#E9A23C', paddingHorizontal:24, paddingVertical:12, borderRadius:12 }}
          onPress={() => this.setState({ hasError: false, error: undefined })}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:15 }}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
}

export function Pill({ label, color }: { label:string; color:string }) {
  return (
    <View style={[s.pill, {borderColor:color+'33',backgroundColor:color+'15'}]}>
      <Text style={[s.pillText,{color}]}>{label}</Text>
    </View>
  );
}

export function PriceTag({ cents }: { cents:number }) {
  return <Text style={s.price}>${(cents/100).toFixed(2)}</Text>;
}

// Small "Verified" trust pill — mirrors the (now compact) web badge. Only render
// when the business has been approved by a Pulse admin.
export function VerifiedPill() {
  return (
    <View style={s.verifiedPill}>
      <Ionicons name="shield-checkmark" size={10} color="#fff"/>
      <Text style={s.verifiedPillText}>Verified</Text>
    </View>
  );
}
