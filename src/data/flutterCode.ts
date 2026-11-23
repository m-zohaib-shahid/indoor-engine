export interface DartSourceFile {
  path: string;
  name: string;
  category: 'config' | 'service' | 'model' | 'screen' | 'main';
  description: string;
  dependencies: string[];
  code: string;
}

export const FLUTTER_CODE_FILES: DartSourceFile[] = [
  {
    path: 'pubspec.yaml',
    name: 'pubspec.yaml',
    category: 'config',
    description: 'Enterprise Flutter project specification with Supabase Auth, WebSockets, sensors_plus, wifi_scan, vector_math, flutter_blue_plus, and permission_handler.',
    dependencies: ['flutter', 'sensors_plus', 'wifi_scan', 'supabase_flutter', 'vector_math', 'flutter_blue_plus', 'permission_handler'],
    code: `name: indoor_positioning_engine
description: "Enterprise Multi-User Indoor Tracking & Navigation Dashboard with Supabase Auth, BLE RSSI Trilateration, 1D Kalman Filtering, PDR Step Detection, and Dynamic User-to-User A* Routing."
publish_to: 'none'

version: 2.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'
  flutter: ">=3.16.0"

dependencies:
  flutter:
    sdk: flutter

  # Supabase Client: Authentication, Realtime WebSockets, Database CRUD
  supabase_flutter: ^2.8.3

  # Inertial Sensors: Tri-axial Accelerometer & Magnetometer for PDR
  sensors_plus: ^6.1.1

  # Wi-Fi Access Point Scanning for Fingerprinting & Coarse Positioning
  wifi_scan: ^0.4.0

  # High-performance 2D/3D Linear Algebra & Matrix Math
  vector_math: ^2.1.4

  # BLE Scanner for iBeacon / Eddystone RSSI Triangulation
  flutter_blue_plus: ^1.34.5

  # Runtime Permissions Handling (Android 12+ BLE, High Precision Location)
  permission_handler: ^11.3.1

  # UI Icons & Utilities
  cupertino_icons: ^1.0.8

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true

  assets:
    - assets/maps/floor_1.png
    - assets/config/beacons.json
`
  },
  {
    path: 'lib/services/auth_service.dart',
    name: 'auth_service.dart',
    category: 'service',
    description: 'Supabase Authentication service managing user sign-up, sign-in, session state streams, and automatic profile creation in the profiles table.',
    dependencies: ['supabase_flutter'],
    code: `import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// User profile model corresponding to the Supabase 'profiles' table
class UserProfile {
  final String id;
  final String fullName;
  final String email;
  final String role;
  final String department;
  final String? avatarUrl;
  final DateTime createdAt;

  const UserProfile({
    required this.id,
    required this.fullName,
    required this.email,
    this.role = 'Staff Member',
    this.department = 'Engineering',
    this.avatarUrl,
    required this.createdAt,
  });

  factory UserProfile.fromMap(Map<String, dynamic> map) {
    return UserProfile(
      id: map['id'] as String,
      fullName: map['full_name'] as String? ?? 'User',
      email: map['email'] as String? ?? '',
      role: map['role'] as String? ?? 'Staff Member',
      department: map['department'] as String? ?? 'General',
      avatarUrl: map['avatar_url'] as String?,
      createdAt: map['created_at'] != null
          ? DateTime.parse(map['created_at'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'full_name': fullName,
      'email': email,
      'role': role,
      'department': department,
      'avatar_url': avatarUrl,
    };
  }
}

/// Supabase Authentication & Profile Management Service
class AuthService {
  final SupabaseClient _client = Supabase.instance.client;

  /// Stream of Supabase Auth state changes (Signed In, Signed Out, Token Refreshed)
  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  /// Currently authenticated user session
  User? get currentUser => _client.auth.currentUser;

  bool get isAuthenticated => currentUser != null;

  /// Authenticate existing user with Email & Password
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );
      return response;
    } on AuthException catch (e) {
      debugPrint('[AuthService] Sign-in error: \${e.message}');
      rethrow;
    } catch (e) {
      debugPrint('[AuthService] Unexpected sign-in error: \$e');
      throw const AuthException('An unexpected error occurred during login. Please try again.');
    }
  }

  /// Register new user and upsert profile row into 'profiles' table
  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
    String department = 'Operations',
    String role = 'Team Specialist',
  }) async {
    try {
      final response = await _client.auth.signUp(
        email: email.trim(),
        password: password,
        data: {
          'full_name': fullName.trim(),
          'department': department,
          'role': role,
        },
      );

      final user = response.user;
      if (user != null) {
        // Upsert public profile record in database
        await _client.from('profiles').upsert({
          'id': user.id,
          'full_name': fullName.trim(),
          'email': email.trim(),
          'department': department,
          'role': role,
          'created_at': DateTime.now().toIso8601String(),
        });
      }

      return response;
    } on AuthException catch (e) {
      debugPrint('[AuthService] Sign-up error: \${e.message}');
      rethrow;
    } catch (e) {
      debugPrint('[AuthService] Unexpected sign-up error: \$e');
      throw const AuthException('Registration failed. Please check your network and try again.');
    }
  }

  /// Fetch full user profile from 'profiles' table
  Future<UserProfile?> fetchCurrentUserProfile() async {
    final user = currentUser;
    if (user == null) return null;

    try {
      final data = await _client
          .from('profiles')
          .select()
          .eq('id', user.id)
          .maybeSingle();

      if (data != null) {
        return UserProfile.fromMap(data);
      }

      // Fallback: construct profile from auth user metadata
      return UserProfile(
        id: user.id,
        fullName: user.userMetadata?['full_name'] as String? ?? user.email?.split('@').first ?? 'User',
        email: user.email ?? '',
        role: user.userMetadata?['role'] as String? ?? 'Team Specialist',
        department: user.userMetadata?['department'] as String? ?? 'Operations',
        createdAt: DateTime.now(),
      );
    } catch (e) {
      debugPrint('[AuthService] Profile fetch error: \$e');
      return null;
    }
  }

  /// Sign out current user and set offline flag in positions table
  Future<void> signOut() async {
    final user = currentUser;
    if (user != null) {
      try {
        await _client.from('user_positions').update({
          'is_online': false,
          'updated_at': DateTime.now().toIso8601String(),
        }).eq('user_id', user.id);
      } catch (e) {
        debugPrint('[AuthService] Failed to mark offline: \$e');
      }
    }
    await _client.auth.signOut();
  }
}
`
  },
  {
    path: 'lib/screens/auth_screen.dart',
    name: 'auth_screen.dart',
    category: 'screen',
    description: 'Clean, modern glassmorphism Dark Theme UI for Supabase Login & Registration with smooth mode transitions and validation.',
    dependencies: ['flutter', 'supabase_flutter'],
    code: `import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';

/// Modern Dark Theme Glassmorphic Authentication Screen
class AuthScreen extends StatefulWidget {
  final AuthService authService;

  const AuthScreen({super.key, required this.authService});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _departmentController = TextEditingController(text: 'Architecture');

  bool _isSignUp = false;
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _departmentController.dispose();
    super.dispose();
  }

  Future<void> _submitAuth() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      if (_isSignUp) {
        await widget.authService.signUp(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          fullName: _fullNameController.text.trim(),
          department: _departmentController.text.trim(),
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              backgroundColor: Color(0xFF10B981),
              content: Text('Account registered successfully! Welcome to the building.'),
            ),
          );
        }
      } else {
        await widget.authService.signIn(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
      }
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text(e.message),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFFEF4444),
            content: Text('Authentication failed. Please verify credentials.'),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: Stack(
        children: [
          // Background ambient gradient circles
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF06B6D4).withOpacity(0.18),
              ),
            ),
          ),
          Positioned(
            bottom: -80,
            right: -80,
            child: Container(
              width: 360,
              height: 360,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF3B82F6).withOpacity(0.15),
              ),
            ),
          ),

          // Central Glassmorphic Card
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                  child: Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxWidth: 440),
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D1424).withOpacity(0.85),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: const Color(0xFF26385C).withOpacity(0.7),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 32,
                          offset: const Offset(0, 16),
                        ),
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Header Icon
                          Center(
                            child: Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF06B6D4), Color(0xFF2563EB)],
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF06B6D4).withOpacity(0.35),
                                    blurRadius: 18,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.near_me_rounded,
                                color: Colors.white,
                                size: 32,
                              ),
                            ),
                          ),
                          const SizedBox(height: 18),

                          // Title
                          const Text(
                            'Indoor Navigation Engine',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _isSignUp
                                ? 'Create an enterprise profile to join live floor tracking'
                                : 'Sign in to access real-time building floor plan & peer routing',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 28),

                          // Mode Switcher Tabs
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: const Color(0xFF070B14),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFF1E2D4A)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() => _isSignUp = false),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 10),
                                      decoration: BoxDecoration(
                                        color: !_isSignUp
                                            ? const Color(0xFF06B6D4)
                                            : Colors.transparent,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Sign In',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: !_isSignUp ? Colors.black : Colors.white60,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() => _isSignUp = true),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(vertical: 10),
                                      decoration: BoxDecoration(
                                        color: _isSignUp
                                            ? const Color(0xFF06B6D4)
                                            : Colors.transparent,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Register',
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          color: _isSignUp ? Colors.black : Colors.white60,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 22),

                          // Sign-up additional fields
                          if (_isSignUp) ...[
                            TextFormField(
                              controller: _fullNameController,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                              decoration: _inputDecoration(
                                label: 'Full Name',
                                icon: Icons.person_outline,
                              ),
                              validator: (val) =>
                                  val == null || val.trim().isEmpty ? 'Please enter full name' : null,
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _departmentController,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                              decoration: _inputDecoration(
                                label: 'Department / Team',
                                icon: Icons.business_outlined,
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],

                          // Email field
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: _inputDecoration(
                              label: 'Work Email',
                              icon: Icons.alternate_email,
                            ),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) return 'Enter your email';
                              if (!val.contains('@') || !val.contains('.')) return 'Enter valid email';
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),

                          // Password field
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: _inputDecoration(
                              label: 'Password',
                              icon: Icons.lock_outline,
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                  color: Colors.white38,
                                  size: 18,
                                ),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (val) =>
                                val == null || val.length < 6 ? 'Password must be at least 6 chars' : null,
                          ),
                          const SizedBox(height: 24),

                          // Submit Action Button
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF06B6D4),
                              foregroundColor: const Color(0xFF070B14),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 4,
                            ),
                            onPressed: _isLoading ? null : _submitAuth,
                            child: _isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.black,
                                    ),
                                  )
                                : Text(
                                    _isSignUp ? 'Create Account & Enter' : 'Sign In to Dashboard',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String label,
    required IconData icon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white54, fontSize: 13),
      prefixIcon: Icon(icon, color: const Color(0xFF06B6D4), size: 20),
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: const Color(0xFF090D18),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF1E2D4A)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF06B6D4), width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFEF4444)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
      ),
    );
  }
}
`
  },
  {
    path: 'lib/services/supabase_sync_service.dart',
    name: 'supabase_sync_service.dart',
    category: 'service',
    description: 'Real-time multi-user location synchronization using Supabase Realtime Channels, 3 Hz throttled upsert, and active online building peers stream.',
    dependencies: ['supabase_flutter', 'vector_math'],
    code: `import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:vector_math/vector_math_64.dart' as vmath;

/// Model representing another active user moving in the building
class BuildingUser {
  final String userId;
  final String fullName;
  final String email;
  final String role;
  final String department;
  final vmath.Vector2 position;
  final int floor;
  final double heading;
  final double accuracy;
  final bool isOnline;
  final DateTime lastUpdated;

  const BuildingUser({
    required this.userId,
    required this.fullName,
    required this.email,
    this.role = 'Specialist',
    this.department = 'Engineering',
    required this.position,
    required this.floor,
    required this.heading,
    required this.accuracy,
    required this.isOnline,
    required this.lastUpdated,
  });

  factory BuildingUser.fromRealtimeMap(Map<String, dynamic> map) {
    final profile = map['profiles'] as Map<String, dynamic>?;

    return BuildingUser(
      userId: map['user_id'] as String,
      fullName: profile?['full_name'] as String? ?? map['display_name'] as String? ?? 'User',
      email: profile?['email'] as String? ?? '',
      role: profile?['role'] as String? ?? 'Specialist',
      department: profile?['department'] as String? ?? 'Operations',
      position: vmath.Vector2(
        (map['x_pos'] ?? map['x'] as num).toDouble(),
        (map['y_pos'] ?? map['y'] as num).toDouble(),
      ),
      floor: map['floor'] as int? ?? 1,
      heading: (map['heading'] as num?)?.toDouble() ?? 0.0,
      accuracy: (map['accuracy'] as num?)?.toDouble() ?? 1.5,
      isOnline: map['is_online'] as bool? ?? true,
      lastUpdated: map['updated_at'] != null
          ? DateTime.parse(map['updated_at'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toPositionUpsertMap() {
    return {
      'user_id': userId,
      'x_pos': position.x,
      'y_pos': position.y,
      'floor': floor,
      'heading': heading,
      'accuracy': accuracy,
      'is_online': isOnline,
      'updated_at': lastUpdated.toIso8601String(),
    };
  }
}

/// Supabase Realtime Multi-User Positioning & Synchronization Service
class SupabaseSyncService {
  final SupabaseClient _client = Supabase.instance.client;
  final String currentUserId;
  final String currentUserName;

  RealtimeChannel? _floorChannel;
  final Map<String, BuildingUser> _activeBuildingPeers = {};

  final StreamController<List<BuildingUser>> _peersStreamController =
      StreamController<List<BuildingUser>>.broadcast();

  // Throttle timer: caps uploads to 3 Hz (330 ms) to conserve battery & network
  DateTime _lastBroadcastTime = DateTime.fromMillisecondsSinceEpoch(0);
  static const int throttleIntervalMs = 330;

  Stream<List<BuildingUser>> get activePeersStream => _peersStreamController.stream;
  List<BuildingUser> get activePeersList => _activeBuildingPeers.values.toList();

  SupabaseSyncService({
    required this.currentUserId,
    required this.currentUserName,
  });

  /// Subscribes to real-time broadcasts on the current building floor
  void joinFloorChannel(int floor) {
    _floorChannel?.unsubscribe();

    _floorChannel = _client.channel('building_floor_\$floor');

    // Listen to live peer position broadcasts
    _floorChannel!
        .onBroadcast(
          event: 'peer_location_update',
          callback: (payload) {
            try {
              final peer = BuildingUser.fromRealtimeMap(payload);
              if (peer.userId != currentUserId) {
                _activeBuildingPeers[peer.userId] = peer;
                _peersStreamController.add(_activeBuildingPeers.values.toList());
              }
            } catch (err) {
              debugPrint('[SupabaseSyncService] Broadcast parse error: \$err');
            }
          },
        )
        .subscribe();

    // Initial fetch of active online users from table
    fetchOnlineBuildingUsers(floor);
  }

  /// Fetches all active users from database matching the floor
  Future<List<BuildingUser>> fetchOnlineBuildingUsers(int floor) async {
    try {
      final List<dynamic> records = await _client
          .from('user_positions')
          .select('*, profiles(full_name, email, role, department)')
          .eq('floor', floor)
          .eq('is_online', true)
          .neq('user_id', currentUserId);

      for (final item in records) {
        final peer = BuildingUser.fromRealtimeMap(item as Map<String, dynamic>);
        _activeBuildingPeers[peer.userId] = peer;
      }

      _peersStreamController.add(_activeBuildingPeers.values.toList());
      return _activeBuildingPeers.values.toList();
    } catch (e) {
      debugPrint('[SupabaseSyncService] Error fetching building users: \$e');
      return _activeBuildingPeers.values.toList();
    }
  }

  /// Throttled 3 Hz position upsert and broadcast to floor channel
  Future<void> broadcastPosition({
    required vmath.Vector2 position,
    required int floor,
    required double heading,
    required double accuracy,
  }) async {
    final now = DateTime.now();
    if (now.difference(_lastBroadcastTime).inMilliseconds < throttleIntervalMs) {
      return; // Throttled to 3 Hz
    }
    _lastBroadcastTime = now;

    final payload = {
      'user_id': currentUserId,
      'display_name': currentUserName,
      'x_pos': position.x,
      'y_pos': position.y,
      'floor': floor,
      'heading': heading,
      'accuracy': accuracy,
      'is_online': true,
      'updated_at': now.toIso8601String(),
    };

    try {
      // 1. Broadcast over WebSocket channel to all connected peers
      _floorChannel?.sendBroadcastMessage(
        event: 'peer_location_update',
        payload: payload,
      );

      // 2. Persist coordinates in database table
      await _client.from('user_positions').upsert({
        'user_id': currentUserId,
        'x_pos': position.x,
        'y_pos': position.y,
        'floor': floor,
        'heading': heading,
        'accuracy': accuracy,
        'is_online': true,
        'updated_at': now.toIso8601String(),
      });
    } catch (e) {
      debugPrint('[SupabaseSyncService] Broadcast error: \$e');
    }
  }

  void dispose() {
    _floorChannel?.unsubscribe();
    _peersStreamController.close();
  }
}
`
  },
  {
    path: 'lib/models/building_graph.dart',
    name: 'building_graph.dart',
    category: 'model',
    description: 'Kindona-based Topological Building Graph with priority-queue A* algorithm supporting arbitrary dynamic start coordinates (x1, y1) and target destination coordinates (x2, y2).',
    dependencies: ['vector_math'],
    code: `import 'dart:math' as math;
import 'package:vector_math/vector_math_64.dart' as vmath;

enum NodeType {
  room,
  corridor,
  door,
  elevator,
  stairs,
  entrance,
  atrium,
}

/// A node in the indoor topological navigation graph
class BuildingNode {
  final String id;
  final String label;
  final int floor;
  final vmath.Vector2 position; // 2D position in meters (x, y)
  final NodeType type;
  final Map<String, dynamic> metadata;

  const BuildingNode({
    required this.id,
    required this.label,
    required this.floor,
    required this.position,
    this.type = NodeType.corridor,
    this.metadata = const {},
  });

  double distanceTo(BuildingNode other) {
    if (floor != other.floor) {
      return (position - other.position).length + 8.0; // Vertical transition penalty
    }
    return (position - other.position).length;
  }
}

/// A bidirectional or directional edge connecting two nodes
class BuildingEdge {
  final String sourceId;
  final String targetId;
  final double weightMeters;
  final bool isWheelchairAccessible;

  const BuildingEdge({
    required this.sourceId,
    required this.targetId,
    required this.weightMeters,
    this.isWheelchairAccessible = true,
  });
}

/// Navigation Turn Instruction
class NavigationStep {
  final String instruction;
  final double distanceMeters;
  final BuildingNode node;

  const NavigationStep({
    required this.instruction,
    required this.distanceMeters,
    required this.node,
  });
}

/// Result of A* Shortest Path query
class PathResult {
  final List<vmath.Vector2> pathCoordinates;
  final List<BuildingNode> pathNodes;
  final double totalDistanceMeters;
  final List<NavigationStep> steps;

  const PathResult({
    required this.pathCoordinates,
    required this.pathNodes,
    required this.totalDistanceMeters,
    required this.steps,
  });

  bool get isEmpty => pathCoordinates.isEmpty;
  bool get isNotEmpty => pathCoordinates.isNotEmpty;
}

/// Indoor Building Graph Architecture with Dynamic A* Pathfinding (Kindona framework)
class BuildingGraph {
  final Map<String, BuildingNode> nodes = {};
  final Map<String, List<BuildingEdge>> adjacencyList = {};

  void addNode(BuildingNode node) {
    nodes[node.id] = node;
    adjacencyList.putIfAbsent(node.id, () => []);
  }

  void addEdge(String fromId, String toId, {bool bidirectional = true, bool wheelchairAccessible = true}) {
    final fromNode = nodes[fromId];
    final toNode = nodes[toId];
    if (fromNode == null || toNode == null) return;

    final double distance = fromNode.distanceTo(toNode);

    adjacencyList[fromId]?.add(BuildingEdge(
      sourceId: fromId,
      targetId: toId,
      weightMeters: distance,
      isWheelchairAccessible: wheelchairAccessible,
    ));

    if (bidirectional) {
      adjacencyList[toId]?.add(BuildingEdge(
        sourceId: toId,
        targetId: fromId,
        weightMeters: distance,
        isWheelchairAccessible: wheelchairAccessible,
      ));
    }
  }

  /// Finds the closest walkable graph node to an arbitrary 2D coordinate point
  BuildingNode? findNearestNode(vmath.Vector2 point, int floor) {
    BuildingNode? nearest;
    double minDistance = double.infinity;

    for (final node in nodes.values) {
      if (node.floor != floor) continue;
      final double dist = (node.position - point).length;
      if (dist < minDistance) {
        minDistance = dist;
        nearest = node;
      }
    }
    return nearest;
  }

  /// Dynamic A* pathfinding between two arbitrary continuous 2D coordinates (x1, y1) and (x2, y2).
  /// Connects start coordinate -> nearest entry node -> A* mesh -> nearest exit node -> target coordinate.
  PathResult findPathBetweenCoordinates({
    required vmath.Vector2 startPoint,
    required vmath.Vector2 targetPoint,
    required int floor,
    String? targetUserOrRoomName,
  }) {
    final startNode = findNearestNode(startPoint, floor);
    final targetNode = findNearestNode(targetPoint, floor);

    if (startNode == null || targetNode == null) {
      return const PathResult(pathCoordinates: [], pathNodes: [], totalDistanceMeters: 0, steps: []);
    }

    // Direct line-of-sight shortcut if extremely close (< 2.5 meters)
    if (startNode.id == targetNode.id && (startPoint - targetPoint).length < 2.5) {
      return PathResult(
        pathCoordinates: [startPoint, targetPoint],
        pathNodes: [startNode],
        totalDistanceMeters: (startPoint - targetPoint).length,
        steps: [
          NavigationStep(
            instruction: 'Target is directly nearby: \${targetUserOrRoomName ?? "Destination"}',
            distanceMeters: (startPoint - targetPoint).length,
            node: startNode,
          ),
        ],
      );
    }

    // Run A* algorithm between startNode and targetNode
    final meshResult = _runAStarSearch(startNode.id, targetNode.id);

    // Prepend exact user continuous coordinate and append exact target continuous coordinate
    final List<vmath.Vector2> completePathCoords = [
      startPoint,
      ...meshResult.pathNodes.map((n) => n.position),
      targetPoint,
    ];

    double finalDistance = (startPoint - startNode.position).length +
        meshResult.totalDistanceMeters +
        (targetNode.position - targetPoint).length;

    // Enhance navigation turn instructions with target name
    final List<NavigationStep> enhancedSteps = List.from(meshResult.steps);
    if (enhancedSteps.isNotEmpty && targetUserOrRoomName != null) {
      enhancedSteps[enhancedSteps.length - 1] = NavigationStep(
        instruction: 'Meet \${targetUserOrRoomName} at \${targetNode.label}',
        distanceMeters: (targetNode.position - targetPoint).length,
        node: targetNode,
      );
    }

    return PathResult(
      pathCoordinates: completePathCoords,
      pathNodes: meshResult.pathNodes,
      totalDistanceMeters: finalDistance,
      steps: enhancedSteps,
    );
  }

  PathResult _runAStarSearch(String startNodeId, String targetNodeId) {
    final startNode = nodes[startNodeId];
    final targetNode = nodes[targetNodeId];

    if (startNode == null || targetNode == null) {
      return const PathResult(pathCoordinates: [], pathNodes: [], totalDistanceMeters: 0, steps: []);
    }

    final Set<String> closedSet = {};
    final Set<String> openSet = {startNodeId};
    final Map<String, String> cameFrom = {};

    final Map<String, double> gScore = {startNodeId: 0.0};
    final Map<String, double> fScore = {
      startNodeId: startNode.distanceTo(targetNode),
    };

    while (openSet.isNotEmpty) {
      String currentId = openSet.first;
      double lowestF = fScore[currentId] ?? double.infinity;

      for (final id in openSet) {
        final score = fScore[id] ?? double.infinity;
        if (score < lowestF) {
          lowestF = score;
          currentId = id;
        }
      }

      if (currentId == targetNodeId) {
        return _reconstructPath(cameFrom, currentId, gScore[currentId] ?? 0.0);
      }

      openSet.remove(currentId);
      closedSet.add(currentId);

      final neighbors = adjacencyList[currentId] ?? [];

      for (final edge in neighbors) {
        final neighborId = edge.targetId;
        if (closedSet.contains(neighborId)) continue;

        final neighborNode = nodes[neighborId];
        if (neighborNode == null) continue;

        final tentativeG = (gScore[currentId] ?? double.infinity) + edge.weightMeters;

        if (!openSet.contains(neighborId)) {
          openSet.add(neighborId);
        } else if (tentativeG >= (gScore[neighborId] ?? double.infinity)) {
          continue;
        }

        cameFrom[neighborId] = currentId;
        gScore[neighborId] = tentativeG;
        fScore[neighborId] = tentativeG + neighborNode.distanceTo(targetNode);
      }
    }

    return const PathResult(pathCoordinates: [], pathNodes: [], totalDistanceMeters: 0, steps: []);
  }

  PathResult _reconstructPath(Map<String, String> cameFrom, String currentId, double totalDistance) {
    final List<BuildingNode> path = [nodes[currentId]!];
    String curr = currentId;

    while (cameFrom.containsKey(curr)) {
      curr = cameFrom[curr]!;
      path.insert(0, nodes[curr]!);
    }

    final List<NavigationStep> steps = [];
    for (int i = 0; i < path.length; i++) {
      final node = path[i];
      String instruction = 'Proceed to \${node.label}';

      if (i == 0) {
        instruction = 'Depart from \${node.label}';
      } else if (i == path.length - 1) {
        instruction = 'Arrive at destination: \${node.label}';
      } else {
        final prev = path[i - 1];
        final next = path[i + 1];
        final v1 = node.position - prev.position;
        final v2 = next.position - node.position;

        final double angle = math.atan2(v2.y, v2.x) - math.atan2(v1.y, v1.x);
        double deg = vmath.degrees(angle);
        while (deg > 180) deg -= 360;
        while (deg < -180) deg += 360;

        if (deg > 35) {
          instruction = 'Turn right towards \${next.label}';
        } else if (deg < -35) {
          instruction = 'Turn left towards \${next.label}';
        } else {
          instruction = 'Continue straight through \${node.label}';
        }
      }

      final dist = (i < path.length - 1) ? path[i].distanceTo(path[i + 1]) : 0.0;
      steps.add(NavigationStep(instruction: instruction, distanceMeters: dist, node: node));
    }

    return PathResult(
      pathCoordinates: path.map((n) => n.position).toList(),
      pathNodes: path,
      totalDistanceMeters: totalDistance,
      steps: steps,
    );
  }
}
`
  },
  {
    path: 'lib/services/step_detector.dart',
    name: 'step_detector.dart',
    category: 'service',
    description: 'Anti-shake Biphasic PDR Step Detector combining gyroscope wrist-shake rejection, adaptive gravity estimation, Weinberg stride estimation, and smoothed compass heading with calibration.',
    dependencies: ['sensors_plus', 'vector_math'],
    code: `import 'dart:async';
import 'dart:math' as math;
import 'package:sensors_plus/sensors_plus.dart';
import 'package:vector_math/vector_math_64.dart' as vmath;

class StepEvent {
  final vmath.Vector2 displacement;
  final double stepLengthMeters;
  final double headingDegrees;
  final DateTime timestamp;

  const StepEvent({
    required this.displacement,
    required this.stepLengthMeters,
    required this.headingDegrees,
    required this.timestamp,
  });
}

/// Anti-Shake Biphasic PDR Step Detector with Gyro Shake Lockout & Low-Latency Compass
class StepDetectorService {
  final double userHeightMeters;
  final StreamController<StepEvent> _stepController = StreamController<StepEvent>.broadcast();

  StreamSubscription<AccelerometerEvent>? _accelSub;
  StreamSubscription<UserAccelerometerEvent>? _userAccelSub;
  StreamSubscription<GyroscopeEvent>? _gyroSub;
  StreamSubscription<MagnetometerEvent>? _magSub;

  double _gravityMag = 9.81;
  double _smoothAcc = 0.0;
  double _peakAcc = 0.0;
  DateTime _peakTime = DateTime.fromMillisecondsSinceEpoch(0);
  bool _inPeakPhase = false;

  DateTime _lastStepTime = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime _lastPeakTime = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime _shakeLockoutUntil = DateTime.fromMillisecondsSinceEpoch(0);
  int _rapidPeakCount = 0;

  double _headingDeg = 0.0;
  double _rawMagHeading = 0.0;
  double _headingOffset = 0.0;
  vmath.Vector3 _latestUserAcc = vmath.Vector3.zero();
  bool _hasUserAcc = false;

  Stream<StepEvent> get onStepDetected => _stepController.stream;
  double get currentHeadingDegrees => _headingDeg;

  StepDetectorService({this.userHeightMeters = 1.75});

  /// Aligns physical phone facing direction to Map North (0 deg)
  void calibrateHeadingToNorth() {
    _headingOffset = _rawMagHeading;
    _headingDeg = 0.0;
  }

  void startListening() {
    stopListening();

    // 1. Gyroscope wrist-shake gate: rejects hand shakes while seated (> 2.2 rad/s ~ 126 deg/s)
    _gyroSub = gyroscopeEventStream(samplingPeriod: SensorInterval.gameInterval).listen((g) {
      final rotMag = math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
      if (rotMag > 2.2) {
        _shakeLockoutUntil = DateTime.now().add(const Duration(milliseconds: 750));
        _inPeakPhase = false;
        _peakAcc = 0.0;
      }
    });

    // 2. Magnetometer heading with shortest-angle circular smoothing (45% alpha for low latency)
    _magSub = magnetometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen((m) {
      final raw = (math.atan2(m.y, m.x) * 180.0 / math.pi + 360.0) % 360.0;
      _rawMagHeading = raw;
      final calibrated = (raw - _headingOffset + 360.0) % 360.0;
      double delta = calibrated - _headingDeg;
      if (delta > 180.0) delta -= 360.0;
      if (delta < -180.0) delta += 360.0;
      _headingDeg = ((_headingDeg + 0.45 * delta) % 360.0 + 360.0) % 360.0;
    });

    // 3. Linear acceleration stream (without gravity) for vertical dominance check
    _userAccelSub = userAccelerometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen((u) {
      _latestUserAcc = vmath.Vector3(u.x, u.y, u.z);
      _hasUserAcc = true;
    });

    // 4. Biphasic gait cycle detector on accelerometer stream
    _accelSub = accelerometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen((a) {
      final now = DateTime.now();
      final rawMag = math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      if (rawMag < 0.5) return;

      double dynAcc;
      if (_hasUserAcc) {
        final gVec = vmath.Vector3(a.x - _latestUserAcc.x, a.y - _latestUserAcc.y, a.z - _latestUserAcc.z);
        final gLen = gVec.length;
        final linLen = _latestUserAcc.length;
        if (gLen > 4.0) {
          final verticalBounce = -(_latestUserAcc.dot(gVec) / gLen);
          // Reject horizontal/lateral wrist shakes while seated
          if (linLen > 2.2 && verticalBounce.abs() < linLen * 0.42) {
            _inPeakPhase = false;
            return;
          }
          dynAcc = verticalBounce;
        } else {
          _gravityMag = 0.92 * _gravityMag + 0.08 * rawMag;
          dynAcc = rawMag - _gravityMag;
        }
      } else {
        final alpha = (rawMag - _gravityMag).abs() < 1.2 ? 0.12 : 0.04;
        _gravityMag = (1.0 - alpha) * _gravityMag + alpha * rawMag;
        dynAcc = rawMag - _gravityMag;
      }

      _smoothAcc = 0.68 * dynAcc + 0.32 * _smoothAcc;

      if (_smoothAcc.abs() > 7.8) {
        _shakeLockoutUntil = now.add(const Duration(milliseconds: 900));
        _inPeakPhase = false;
        _peakAcc = 0.0;
        return;
      }

      if (now.isBefore(_shakeLockoutUntil)) {
        _inPeakPhase = false;
        return;
      }

      if (_smoothAcc > 1.35) {
        if (!_inPeakPhase) {
          if (now.difference(_lastPeakTime).inMilliseconds < 300) {
            _rapidPeakCount++;
            if (_rapidPeakCount >= 2) {
              _shakeLockoutUntil = now.add(const Duration(milliseconds: 900));
              _rapidPeakCount = 0;
              _inPeakPhase = false;
              return;
            }
          } else {
            _rapidPeakCount = 0;
          }
          _lastPeakTime = now;
          _inPeakPhase = true;
          _peakAcc = _smoothAcc;
          _peakTime = now;
        } else if (_smoothAcc > _peakAcc) {
          _peakAcc = _smoothAcc;
          _peakTime = now;
        }
      } else if (_inPeakPhase) {
        final elapsedMs = now.difference(_peakTime).inMilliseconds;
        if (elapsedMs > 520) {
          _inPeakPhase = false;
          _peakAcc = 0.0;
          return;
        }

        if (_smoothAcc < -0.82 && elapsedMs >= 95) {
          final amplitude = _peakAcc - _smoothAcc;
          _inPeakPhase = false;
          _peakAcc = 0.0;

          if (amplitude >= 2.45 && now.difference(_lastStepTime).inMilliseconds >= 400) {
            _lastStepTime = now;
            final stepLen = (0.44 * math.pow(math.max(1.0, amplitude), 0.25)).clamp(0.55, 0.85);
            final rad = (_headingDeg - 90.0) * math.pi / 180.0;
            final disp = vmath.Vector2(math.cos(rad) * stepLen, math.sin(rad) * stepLen);

            _stepController.add(StepEvent(
              displacement: disp,
              stepLengthMeters: stepLen,
              headingDegrees: _headingDeg,
              timestamp: now,
            ));
          }
        }
      }
    });
  }

  void stopListening() {
    _accelSub?.cancel();
    _userAccelSub?.cancel();
    _gyroSub?.cancel();
    _magSub?.cancel();
  }

  void dispose() {
    stopListening();
    _stepController.close();
  }
}
`
  },
  {
    path: 'lib/services/location_fusion_service.dart',
    name: 'location_fusion_service.dart',
    category: 'service',
    description: '1D Kalman Filter, Log-Distance Path Loss, Linearized Matrix Trilateration, PDR fusion, and Dynamic Target Locking with auto-recalculating A* route.',
    dependencies: ['vector_math'],
    code: `import 'dart:async';
import 'dart:math' as math;
import 'package:vector_math/vector_math_64.dart' as vmath;
import '../models/building_graph.dart';
import 'step_detector.dart';

/// 1D Kalman Filter for scalar RSSI / Distance noise suppression
class KalmanFilter1D {
  double q; // Process noise covariance
  double r; // Measurement noise covariance
  double p; // Estimation error covariance
  double x; // Filtered value
  double k; // Kalman gain

  KalmanFilter1D({
    this.q = 0.012,
    this.r = 2.0,
    this.p = 1.0,
    this.x = -65.0,
  }) : k = 0.0;

  double update(double measurement) {
    p = p + q;
    k = p / (p + r);
    x = x + k * (measurement - x);
    p = (1.0 - k) * p;
    return x;
  }

  void reset(double val) {
    x = val;
    p = 1.0;
  }
}

/// Fixed BLE reference beacon node
class BeaconNode {
  final String id;
  final String name;
  final vmath.Vector2 position;
  final int floor;
  final double txPower; // RSSI at 1 meter (e.g. -59 dBm)
  final double pathLossExponent; // Environmental 'n' (2.0 - 3.2)

  final KalmanFilter1D kalmanFilter;
  double lastRawRssi = -100.0;
  double lastFilteredRssi = -100.0;
  double estimatedDistanceMeters = 0.0;
  DateTime lastSeen = DateTime.fromMillisecondsSinceEpoch(0);

  BeaconNode({
    required this.id,
    required this.name,
    required this.position,
    this.floor = 1,
    this.txPower = -59.0,
    this.pathLossExponent = 2.2,
  }) : kalmanFilter = KalmanFilter1D(q: 0.012, r: 2.0);

  /// Converts RSSI to distance: d = 10 ^ ((TxPower - RSSI) / (10 * n))
  double updateRssi(double rawRssi) {
    lastRawRssi = rawRssi;
    lastFilteredRssi = kalmanFilter.update(rawRssi);
    lastSeen = DateTime.now();

    final double exponent = (txPower - lastFilteredRssi) / (10.0 * pathLossExponent);
    estimatedDistanceMeters = math.pow(10.0, exponent).toDouble();
    return estimatedDistanceMeters;
  }
}

/// Unified Fused Location Output
class FusedLocation {
  final vmath.Vector2 position;
  final double accuracyMeters;
  final int floor;
  final double headingDegrees;
  final bool isBleTrilaterated;
  final DateTime timestamp;

  const FusedLocation({
    required this.position,
    required this.accuracyMeters,
    required this.floor,
    required this.headingDegrees,
    required this.isBleTrilaterated,
    required this.timestamp,
  });
}

/// Location Fusion Service with Dynamic Peer Target Locking & Auto-Recalculation
class LocationFusionService {
  final Map<String, BeaconNode> _beacons = {};
  final BuildingGraph buildingGraph;

  vmath.Vector2 _currentPosition = vmath.Vector2(16.0, 13.0);
  double _currentHeading = 0.0;
  int _currentFloor = 1;
  double bleFusionAlpha = 0.35;

  // Dynamic Navigation Target (Room or Peer User)
  vmath.Vector2? _targetDestination;
  String? _targetLabel;
  String? _lockedPeerUserId;
  PathResult? _currentPath;

  final StreamController<FusedLocation> _locationController =
      StreamController<FusedLocation>.broadcast();
  final StreamController<PathResult?> _pathController =
      StreamController<PathResult?>.broadcast();

  Stream<FusedLocation> get locationStream => _locationController.stream;
  Stream<PathResult?> get pathStream => _pathController.stream;
  vmath.Vector2 get currentPosition => _currentPosition;
  PathResult? get currentActivePath => _currentPath;
  String? get lockedPeerUserId => _lockedPeerUserId;
  String? get targetLabel => _targetLabel;

  LocationFusionService({
    required this.buildingGraph,
    List<BeaconNode>? initialBeacons,
    vmath.Vector2? startPosition,
  }) {
    if (initialBeacons != null) {
      for (final b in initialBeacons) {
        _beacons[b.id] = b;
      }
    }
    if (startPosition != null) {
      _currentPosition = startPosition;
    }
  }

  void registerBeacon(BeaconNode beacon) {
    _beacons[beacon.id] = beacon;
  }

  /// Ingests live RSSI measurement from BLE scanner
  void ingestBeaconRssi(String beaconId, double rawRssi) {
    final beacon = _beacons[beaconId];
    if (beacon == null) return;
    beacon.updateRssi(rawRssi);
    _performFusionCycle();
  }

  /// Solid building walls with doorway gaps (prevents walking through walls)
  static final List<List<double>> _wallSegments = [
    // Outer perimeter
    [1.0, 1.0, 31.0, 1.0], [31.0, 1.0, 31.0, 24.1], [31.0, 24.1, 1.0, 24.1], [1.0, 24.1, 1.0, 1.0],
    // Lab 101 walls with East & South doorways
    [2.0, 2.0, 12.0, 2.0], [2.0, 2.0, 2.0, 10.5],
    [12.0, 2.0, 12.0, 5.4], [12.0, 7.6, 12.0, 10.5],
    [2.0, 10.5, 9.4, 10.5], [11.6, 10.5, 12.0, 10.5],
    // Conference Room A walls with West & South doorways
    [20.0, 2.0, 30.0, 2.0], [30.0, 2.0, 30.0, 10.5],
    [20.0, 2.0, 20.0, 5.4], [20.0, 7.6, 20.0, 10.5],
    [20.0, 10.5, 20.4, 10.5], [22.6, 10.5, 30.0, 10.5],
    // Server Hub walls with South doorway
    [13.0, 1.5, 19.0, 1.5], [13.0, 1.5, 13.0, 5.5], [19.0, 1.5, 19.0, 5.5],
    [13.0, 5.5, 14.9, 5.5], [17.1, 5.5, 19.0, 5.5],
    // Cafeteria walls with East & North doorways
    [2.0, 15.5, 9.4, 15.5], [11.6, 15.5, 12.0, 15.5],
    [2.0, 15.5, 2.0, 24.0], [2.0, 24.0, 12.0, 24.0],
    [12.0, 15.5, 12.0, 18.4], [12.0, 20.6, 12.0, 24.0],
    // Executive Suite walls with West & North doorways
    [20.0, 15.5, 20.4, 15.5], [22.6, 15.5, 30.0, 15.5],
    [30.0, 15.5, 30.0, 24.0], [20.0, 24.0, 30.0, 24.0],
    [20.0, 15.5, 20.0, 18.4], [20.0, 20.6, 20.0, 24.0],
  ];

  bool _isMoveClear(double fx, double fy, double tx, double ty) {
    const double rSq = 0.34 * 0.34;
    for (final w in _wallSegments) {
      final x1 = w[0], y1 = w[1], x2 = w[2], y2 = w[3];
      final d1 = (y2 - y1) * (fx - x1) - (x2 - x1) * (fy - y1);
      final d2 = (y2 - y1) * (tx - x1) - (x2 - x1) * (ty - y1);
      final d3 = (ty - fy) * (x1 - fx) - (tx - fx) * (y1 - fy);
      final d4 = (ty - fy) * (x2 - fx) - (tx - fx) * (y2 - fy);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return false;
      }
      final vx = x2 - x1, vy = y2 - y1;
      final lenSq = vx * vx + vy * vy;
      final t = lenSq < 1e-8 ? 0.0 : (((tx - x1) * vx + (ty - y1) * vy) / lenSq).clamp(0.0, 1.0);
      final cx = x1 + t * vx, cy = y1 + t * vy;
      if ((tx - cx) * (tx - cx) + (ty - cy) * (ty - cy) < rSq) return false;
    }
    return true;
  }

  vmath.Vector2 _resolveWallCollision(vmath.Vector2 from, vmath.Vector2 delta) {
    final dist = delta.length;
    if (dist < 1e-5) return from;
    final steps = math.max(1, (dist / 0.14).ceil());
    final stepDx = delta.x / steps;
    final stepDy = delta.y / steps;
    double cx = from.x, cy = from.y;
    for (int i = 0; i < steps; i++) {
      final nx = (cx + stepDx).clamp(1.4, 30.6);
      final ny = (cy + stepDy).clamp(1.4, 23.7);
      if (_isMoveClear(cx, cy, nx, ny)) {
        cx = nx;
        cy = ny;
      } else if (_isMoveClear(cx, cy, nx, cy)) {
        cx = nx;
      } else if (_isMoveClear(cx, cy, cx, ny)) {
        cy = ny;
      } else {
        break;
      }
    }
    return vmath.Vector2(cx, cy);
  }

  /// Ingests PDR step event from accelerometer with wall collision & sliding
  void ingestPdrStep(StepEvent step) {
    _currentHeading = step.headingDegrees;
    _currentPosition = _resolveWallCollision(_currentPosition, step.displacement);
    _performFusionCycle(isStepTriggered: true);
  }

  /// Locks navigation target to another active building user
  void setTargetPeerUser({
    required String peerUserId,
    required String peerName,
    required vmath.Vector2 peerCoords,
    required int peerFloor,
  }) {
    _lockedPeerUserId = peerUserId;
    _targetLabel = peerName;
    _targetDestination = peerCoords;
    _currentFloor = peerFloor;
    recalculateRoute();
  }

  /// Locks navigation target to a fixed room or waypoint
  void setTargetRoom({
    required String roomName,
    required vmath.Vector2 roomCoords,
    required int floor,
  }) {
    _lockedPeerUserId = null;
    _targetLabel = roomName;
    _targetDestination = roomCoords;
    _currentFloor = floor;
    recalculateRoute();
  }

  /// Updates peer location in real-time as they walk; automatically updates path
  void updateLockedPeerPosition(String peerUserId, vmath.Vector2 newCoords) {
    if (_lockedPeerUserId == peerUserId) {
      _targetDestination = newCoords;
      recalculateRoute();
    }
  }

  void clearTarget() {
    _lockedPeerUserId = null;
    _targetDestination = null;
    _targetLabel = null;
    _currentPath = null;
    _pathController.add(null);
  }

  /// Recalculates dynamic A* path between continuous user coordinates & destination
  void recalculateRoute() {
    if (_targetDestination == null) return;

    final path = buildingGraph.findPathBetweenCoordinates(
      startPoint: _currentPosition,
      targetPoint: _targetDestination!,
      floor: _currentFloor,
      targetUserOrRoomName: _targetLabel,
    );

    _currentPath = path;
    _pathController.add(path);
  }

  /// 2D Linearized Least Squares Trilateration Matrix Solver
  vmath.Vector2? calculateTrilateration(List<BeaconNode> activeBeacons) {
    if (activeBeacons.length < 3) return null;

    final b1 = activeBeacons[0];
    final b2 = activeBeacons[1];
    final b3 = activeBeacons[2];

    final double x1 = b1.position.x, y1 = b1.position.y, r1 = b1.estimatedDistanceMeters;
    final double x2 = b2.position.x, y2 = b2.position.y, r2 = b2.estimatedDistanceMeters;
    final double x3 = b3.position.x, y3 = b3.position.y, r3 = b3.estimatedDistanceMeters;

    final double a11 = 2.0 * (x2 - x1);
    final double a12 = 2.0 * (y2 - y1);
    final double b1Val = (r1 * r1 - r2 * r2) + (x2 * x2 - x1 * x1) + (y2 * y2 - y1 * y1);

    final double a21 = 2.0 * (x3 - x1);
    final double a22 = 2.0 * (y3 - y1);
    final double b2Val = (r1 * r1 - r3 * r3) + (x3 * x3 - x1 * x1) + (y3 * y3 - y1 * y1);

    final double det = (a11 * a22) - (a12 * a21);
    if (det.abs() < 1e-6) {
      return null;
    }

    final double solvedX = (b1Val * a22 - b2Val * a12) / det;
    final double solvedY = (a11 * b2Val - a21 * b1Val) / det;

    return vmath.Vector2(solvedX, solvedY);
  }

  void _performFusionCycle({bool isStepTriggered = false}) {
    final now = DateTime.now();

    final activeBeacons = _beacons.values
        .where((b) => b.floor == _currentFloor && now.difference(b.lastSeen).inMilliseconds < 4000)
        .toList()
      ..sort((a, b) => a.estimatedDistanceMeters.compareTo(b.estimatedDistanceMeters));

    bool hasTrilateration = false;
    double accuracy = 2.2;

    if (activeBeacons.length >= 3) {
      final triPoint = calculateTrilateration(activeBeacons.take(4).toList());
      if (triPoint != null && !triPoint.x.isNaN && !triPoint.y.isNaN) {
        hasTrilateration = true;
        if (isStepTriggered) {
          _currentPosition = (_currentPosition * (1.0 - bleFusionAlpha)) + (triPoint * bleFusionAlpha);
        } else {
          _currentPosition = (_currentPosition * 0.85) + (triPoint * 0.15);
        }
        accuracy = 1.2;
      }
    }

    // Auto-update path if user moved and destination is locked
    if (_targetDestination != null) {
      recalculateRoute();
    }

    _locationController.add(FusedLocation(
      position: vmath.Vector2(_currentPosition.x, _currentPosition.y),
      accuracyMeters: accuracy,
      floor: _currentFloor,
      headingDegrees: _currentHeading,
      isBleTrilaterated: hasTrilateration,
      timestamp: now,
    ));
  }

  void setManualPosition(vmath.Vector2 pos, {int? floor}) {
    _currentPosition = pos;
    if (floor != null) _currentFloor = floor;
    _performFusionCycle();
  }

  void dispose() {
    _locationController.close();
    _pathController.close();
  }
}
`
  },
  {
    path: 'lib/screens/indoor_map_screen.dart',
    name: 'indoor_map_screen.dart',
    category: 'screen',
    description: 'Interactive floor plan screen with active building users drawer, user-to-user target navigation, live A* route rendering, and guidance banner.',
    dependencies: ['flutter', 'vector_math'],
    code: `import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart' as vmath;
import '../models/building_graph.dart';
import '../services/auth_service.dart';
import '../services/location_fusion_service.dart';
import '../services/step_detector.dart';
import '../services/supabase_sync_service.dart';

/// Clean Minimalist Indoor Navigation Dashboard Screen with Live Distance Countdown & Touch Controls
class IndoorMapScreen extends StatefulWidget {
  final AuthService authService;
  final LocationFusionService fusionService;
  final StepDetectorService stepDetectorService;
  final SupabaseSyncService syncService;
  final BuildingGraph buildingGraph;

  const IndoorMapScreen({
    super.key,
    required this.authService,
    required this.fusionService,
    required this.stepDetectorService,
    required this.syncService,
    required this.buildingGraph,
  });

  @override
  State<IndoorMapScreen> createState() => _IndoorMapScreenState();
}

class _IndoorMapScreenState extends State<IndoorMapScreen>
    with SingleTickerProviderStateMixin {
  final TransformationController _transformController = TransformationController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  late AnimationController _pulseController;

  FusedLocation? _currentLocation;
  PathResult? _activePath;
  List<BuildingUser> _activePeers = [];
  int _selectedFloor = 1;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    // Listen to local fused location
    widget.fusionService.locationStream.listen((loc) {
      if (mounted) {
        setState(() {
          _currentLocation = loc;
          _selectedFloor = loc.floor;
        });

        // Broadcast updated coordinates to Supabase Realtime channel
        widget.syncService.broadcastPosition(
          position: loc.position,
          floor: loc.floor,
          heading: loc.headingDegrees,
          accuracy: loc.accuracyMeters,
        );
      }
    });

    // Listen to dynamic A* path updates
    widget.fusionService.pathStream.listen((path) {
      if (mounted) {
        setState(() => _activePath = path);
      }
    });

    // Listen to remote building peers
    widget.syncService.activePeersStream.listen((peers) {
      if (mounted) {
        setState(() => _activePeers = peers);

        final lockedPeerId = widget.fusionService.lockedPeerUserId;
        if (lockedPeerId != null) {
          final updated = peers.where((p) => p.userId == lockedPeerId).firstOrNull;
          if (updated != null) {
            widget.fusionService.updateLockedPeerPosition(lockedPeerId, updated.position);
          }
        }
      }
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _transformController.value = Matrix4.identity()
        ..translate(40.0, 50.0)
        ..scale(1.25);
    });
  }

  void _navigateToPeer(BuildingUser peer) {
    widget.fusionService.setTargetPeerUser(
      peerUserId: peer.userId,
      peerName: peer.fullName,
      peerCoords: peer.position,
      peerFloor: peer.floor,
    );
  }

  void _stepManual(double dx, double dy) {
    if (_currentLocation == null) return;
    final nextPos = vmath.Vector2(
      (_currentLocation!.position.x + dx).clamp(2.5, 29.5),
      (_currentLocation!.position.y + dy).clamp(2.5, 23.5),
    );
    widget.fusionService.setManualPosition(nextPos);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final userEmail = widget.authService.currentUser?.email ?? 'Architect';
    final userName = widget.authService.currentUser?.userMetadata?['full_name'] as String? ??
        userEmail.split('@').first;
    final userRole = widget.authService.currentUser?.userMetadata?['role'] as String? ??
        'Lead Specialist';

    final targetPeer = _activePeers
        .where((p) => p.userId == widget.fusionService.lockedPeerUserId)
        .firstOrNull;

    // Live continuous Euclidean distance calculation
    final double directDistance = (targetPeer != null && _currentLocation != null)
        ? (targetPeer.position - _currentLocation!.position).length
        : (_activePath?.totalDistanceMeters ?? 0.0);

    final bool hasArrived = (widget.fusionService.lockedPeerUserId != null && directDistance < 1.4);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        titleSpacing: 16,
        leadingWidth: 44,
        leading: Padding(
          padding: const EdgeInsets.only(left: 14),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF06B6D4).withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.explore_rounded, color: Color(0xFF06B6D4), size: 22),
          ),
        ),
        title: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Indoor Nav Engine',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Row(
                  children: [
                    Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    const Text('Connected to Floor 1', style: TextStyle(fontSize: 11, color: Colors.white54)),
                  ],
                ),
              ],
            ),
            const SizedBox(width: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B).withOpacity(0.6),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 9,
                    backgroundColor: const Color(0xFF06B6D4),
                    child: Text(
                      userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                      style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(userName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
                  const SizedBox(width: 4),
                  Text('• \$userRole', style: const TextStyle(fontSize: 11, color: Color(0xFF06B6D4))),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF06B6D4).withOpacity(0.12),
                foregroundColor: const Color(0xFF06B6D4),
                elevation: 0,
                side: const BorderSide(color: Color(0xFF06B6D4), width: 0.8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              icon: const Icon(Icons.people_alt_rounded, size: 16),
              label: Text('Active Users (\${_activePeers.length})', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              onPressed: () => _scaffoldKey.currentState?.openEndDrawer(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.white54, size: 20),
            onPressed: () => widget.authService.signOut(),
          ),
          const SizedBox(width: 12),
        ],
      ),
      endDrawer: Drawer(
        backgroundColor: const Color(0xFF0F172A),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    const Text('Active Building Users', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white)),
                    IconButton(icon: const Icon(Icons.close, color: Colors.white54), onPressed: () => Navigator.pop(context)),
                  ],
                ),
              ),
              const Divider(color: Color(0xFF1E293B), height: 1),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _activePeers.length,
                  itemBuilder: (ctx, index) {
                    final peer = _activePeers[index];
                    final double dist = _currentLocation != null ? (peer.position - _currentLocation!.position).length : 0.0;
                    final isTarget = widget.fusionService.lockedPeerUserId == peer.userId;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isTarget ? const Color(0xFFF59E0B).withOpacity(0.1) : const Color(0xFF1E293B).withOpacity(0.5),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isTarget ? const Color(0xFFF59E0B) : const Color(0xFF334155)),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: const Color(0xFF0F172A),
                                child: Text(peer.fullName.isNotEmpty ? peer.fullName[0].toUpperCase() : 'U', style: const TextStyle(color: Color(0xFF06B6D4))),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(peer.fullName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                                    Text('\${peer.role} • \${peer.department}', style: const TextStyle(color: Colors.white54, fontSize: 11)),
                                  ],
                                ),
                              ),
                              Text('\${dist.toStringAsFixed(1)} m', style: const TextStyle(color: Color(0xFF06B6D4), fontFamily: 'monospace', fontWeight: FontWeight.bold)),
                            ],
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isTarget ? const Color(0xFFF59E0B) : const Color(0xFF06B6D4),
                                foregroundColor: Colors.black,
                                padding: const EdgeInsets.symmetric(vertical: 8),
                              ),
                              icon: const Icon(Icons.near_me_rounded, size: 16),
                              label: Text(isTarget ? 'Route Active' : 'Navigate to User', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                              onPressed: () {
                                Navigator.pop(context);
                                _navigateToPeer(peer);
                              },
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
      body: Stack(
        children: [
          // 2D Floor Plan Canvas in #0F172A
          Center(
            child: InteractiveViewer(
              transformationController: _transformController,
              boundaryMargin: const EdgeInsets.all(500),
              minScale: 0.6,
              maxScale: 3.5,
              child: SizedBox(
                width: 768,
                height: 580,
                child: AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, _) {
                    return CustomPaint(
                      painter: CleanFloorPlanPainter(
                        floor: _selectedFloor,
                        userLocation: _currentLocation,
                        activePath: _activePath,
                        peers: _activePeers.where((p) => p.floor == _selectedFloor).toList(),
                        targetPeerId: widget.fusionService.lockedPeerUserId,
                        pulseValue: _pulseController.value,
                      ),
                    );
                  },
                ),
              ),
            ),
          ),

          // Floating Navigation Guidance Banner with Live Countdown & Arrival State
          if (widget.fusionService.lockedPeerUserId != null || _activePath != null)
            Positioned(
              top: 16,
              left: 20,
              right: 20,
              child: Center(
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 520),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: hasArrived ? const Color(0xFF064E3B).withOpacity(0.95) : const Color(0xFF0F172A).withOpacity(0.95),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: hasArrived ? const Color(0xFF10B981) : const Color(0xFF06B6D4).withOpacity(0.4)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 18, offset: const Offset(0, 8))],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(9),
                        decoration: BoxDecoration(
                          color: hasArrived ? const Color(0xFF10B981).withOpacity(0.2) : const Color(0xFF06B6D4).withOpacity(0.18),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(hasArrived ? Icons.check_circle_rounded : Icons.navigation_rounded, color: hasArrived ? const Color(0xFF10B981) : const Color(0xFF06B6D4), size: 20),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              hasArrived
                                  ? 'You Have Arrived! 🎉'
                                  : (targetPeer != null ? 'Proceed to meet \${targetPeer.fullName}' : 'Proceeding to destination'),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            Text(
                              hasArrived
                                  ? 'Colleague reached at location'
                                  : '\${directDistance.toStringAsFixed(1)} m remaining • ~\$((directDistance / 1.1).round().clamp(1, 999))s walk',
                              style: const TextStyle(color: Colors.white60, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.white70,
                          backgroundColor: const Color(0xFF1E293B),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                        child: Text(hasArrived ? 'Done' : 'Cancel', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        onPressed: () => widget.fusionService.clearTarget(),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // On-Screen Virtual Touch Joystick / Direction D-Pad for Instant Testing
          Positioned(
            bottom: 20,
            left: 20,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF0B101E).withOpacity(0.85),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF1E2D4A)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_upward_rounded, color: Colors.white70),
                    onPressed: () => _stepManual(0, -0.7),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back_rounded, color: Colors.white70),
                        onPressed: () => _stepManual(-0.7, 0),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF06B6D4),
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                        onPressed: () => _stepManual(0, -0.7),
                        child: const Text('+Step', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white70),
                        onPressed: () => _stepManual(0.7, 0),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.arrow_downward_rounded, color: Colors.white70),
                    onPressed: () => _stepManual(0, 0.7),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Floor Plan Painter
class CleanFloorPlanPainter extends CustomPainter {
  final int floor;
  final FusedLocation? userLocation;
  final PathResult? activePath;
  final List<BuildingUser> peers;
  final String? targetPeerId;
  final double pulseValue;

  static const double scale = 24.0;

  CleanFloorPlanPainter({
    required this.floor,
    required this.userLocation,
    required this.activePath,
    required this.peers,
    required this.targetPeerId,
    required this.pulseValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFF0F172A);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    _drawRooms(canvas);

    if (activePath != null && activePath!.pathCoordinates.length > 1) {
      _drawNavigationPath(canvas);
    }

    _drawPeers(canvas);

    if (userLocation != null && userLocation!.floor == floor) {
      _drawCurrentUser(canvas);
    }
  }

  void _drawRooms(Canvas canvas) {
    final roomFill = Paint()..color = const Color(0xFF1E293B).withOpacity(0.5);
    final wallPaint = Paint()
      ..color = const Color(0xFF334155)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final rooms = [
      Rect.fromLTWH(2 * scale, 2 * scale, 10 * scale, 8.5 * scale),
      Rect.fromLTWH(20 * scale, 2 * scale, 10 * scale, 8.5 * scale),
      Rect.fromLTWH(13 * scale, 1.5 * scale, 6 * scale, 4 * scale),
      Rect.fromLTWH(2 * scale, 15.5 * scale, 10 * scale, 8.5 * scale),
      Rect.fromLTWH(20 * scale, 15.5 * scale, 10 * scale, 8.5 * scale),
      Rect.fromLTWH(12 * scale, 9.5 * scale, 8 * scale, 7 * scale),
    ];

    final labels = ['Lab 101', 'Conference Room A', 'Server Hub', 'Cafeteria', 'Executive Suite', 'Central Atrium'];

    for (int i = 0; i < rooms.length; i++) {
      final r = rooms[i];
      final rrect = RRect.fromRectAndRadius(r, const Radius.circular(10));
      canvas.drawRRect(rrect, roomFill);
      canvas.drawRRect(rrect, wallPaint);

      final textSpan = TextSpan(text: labels[i], style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w500));
      final textPainter = TextPainter(text: textSpan, textDirection: TextDirection.ltr)..layout();
      textPainter.paint(canvas, Offset(r.left + 14, r.top + 16));
    }
  }

  void _drawNavigationPath(Canvas canvas) {
    final coords = activePath!.pathCoordinates;

    final glowPaint = Paint()
      ..color = const Color(0xFF06B6D4).withOpacity(0.25)
      ..strokeWidth = 8.0
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final linePaint = Paint()
      ..color = const Color(0xFF06B6D4)
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final path = Path();
    path.moveTo(coords[0].x * scale, coords[0].y * scale);
    for (int i = 1; i < coords.length; i++) {
      path.lineTo(coords[i].x * scale, coords[i].y * scale);
    }

    canvas.drawPath(path, glowPaint);
    canvas.drawPath(path, linePaint);
  }

  void _drawPeers(Canvas canvas) {
    for (final peer in peers) {
      final isTarget = targetPeerId == peer.userId;
      final offset = Offset(peer.position.x * scale, peer.position.y * scale);

      if (isTarget) {
        final pulsePaint = Paint()
          ..color = const Color(0xFFF59E0B).withOpacity(0.8 * (1.0 - pulseValue))
          ..strokeWidth = 2.5
          ..style = PaintingStyle.stroke;
        canvas.drawCircle(offset, 10.0 + (pulseValue * 18.0), pulsePaint);

        final targetPaint = Paint()..color = const Color(0xFFF59E0B);
        final borderPaint = Paint()..color = Colors.white..strokeWidth = 2.0..style = PaintingStyle.stroke;

        canvas.drawCircle(offset, 8.0, targetPaint);
        canvas.drawCircle(offset, 8.0, borderPaint);
      } else {
        final mutedPaint = Paint()..color = const Color(0xFF64748B);
        final borderPaint = Paint()..color = const Color(0xFF334155)..strokeWidth = 1.5..style = PaintingStyle.stroke;

        canvas.drawCircle(offset, 6.0, mutedPaint);
        canvas.drawCircle(offset, 6.0, borderPaint);
      }
    }
  }

  void _drawCurrentUser(Canvas canvas) {
    final center = Offset(userLocation!.position.x * scale, userLocation!.position.y * scale);

    final headingRad = vmath.radians(userLocation!.headingDegrees);
    final conePaint = Paint()
      ..shader = RadialGradient(
        colors: [const Color(0xFF3B82F6).withOpacity(0.35), const Color(0xFF3B82F6).withOpacity(0.0)],
      ).createShader(Rect.fromCircle(center: center, radius: 42))
      ..style = PaintingStyle.fill;

    final conePath = Path()
      ..moveTo(center.dx, center.dy)
      ..arcTo(Rect.fromCircle(center: center, radius: 42), headingRad - math.pi / 2 - 0.42, 0.84, false)
      ..close();
    canvas.drawPath(conePath, conePaint);

    final pulsePaint = Paint()
      ..color = const Color(0xFF3B82F6).withOpacity(0.9 * (1.0 - pulseValue))
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(center, 10.0 + (pulseValue * 18.0), pulsePaint);

    final dotPaint = Paint()..color = const Color(0xFF3B82F6);
    final borderPaint = Paint()..color = Colors.white..strokeWidth = 2.5..style = PaintingStyle.stroke;

    canvas.drawCircle(center, 8.0, dotPaint);
    canvas.drawCircle(center, 8.0, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CleanFloorPlanPainter oldDelegate) => true;
}
`
  },
  {
    path: 'lib/main.dart',
    name: 'main.dart',
    category: 'main',
    description: 'Supabase client initialization, Auth State Gate, Android BLE/Location/Sensors runtime permission handling, and theme bootstrap.',
    dependencies: ['flutter', 'supabase_flutter', 'permission_handler', 'vector_math'],
    code: `import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:vector_math/vector_math_64.dart' as vmath;

import 'models/building_graph.dart';
import 'screens/auth_screen.dart';
import 'screens/indoor_map_screen.dart';
import 'services/auth_service.dart';
import 'services/location_fusion_service.dart';
import 'services/step_detector.dart';
import 'services/supabase_sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Transparent Android status bar
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF070B14),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize Supabase Client
  await Supabase.initialize(
    url: 'https://demo-indoor.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_indoor_navigation',
  );

  runApp(const MultiUserIndoorApp());
}

class MultiUserIndoorApp extends StatefulWidget {
  const MultiUserIndoorApp({super.key});

  @override
  State<MultiUserIndoorApp> createState() => _MultiUserIndoorAppState();
}

class _MultiUserIndoorAppState extends State<MultiUserIndoorApp> {
  final AuthService _authService = AuthService();
  bool _isPermissionsGranted = false;

  late BuildingGraph _buildingGraph;
  late LocationFusionService _fusionService;
  late StepDetectorService _stepDetectorService;
  SupabaseSyncService? _syncService;

  @override
  void initState() {
    super.initState();
    _bootstrapEngine();
  }

  Future<void> _bootstrapEngine() async {
    // 1. Build Kindona topological graph
    _buildingGraph = BuildingGraph();
    _seedBuildingGraph(_buildingGraph);

    // 2. Reference BLE Beacons (ZainCheema math)
    final beacons = [
      BeaconNode(id: 'b_n1', name: 'Beacon N-01', position: vmath.Vector2(8.0, 4.0)),
      BeaconNode(id: 'b_e2', name: 'Beacon E-02', position: vmath.Vector2(25.0, 6.0)),
      BeaconNode(id: 'b_s3', name: 'Beacon S-03', position: vmath.Vector2(16.0, 24.0)),
      BeaconNode(id: 'b_w4', name: 'Beacon W-04', position: vmath.Vector2(6.0, 22.0)),
    ];

    _fusionService = LocationFusionService(
      buildingGraph: _buildingGraph,
      initialBeacons: beacons,
      startPosition: vmath.Vector2(16.0, 13.0),
    );

    // 3. PDR Step Detector
    _stepDetectorService = StepDetectorService(userHeightMeters: 1.78);
    _stepDetectorService.onStepDetected.listen((step) {
      _fusionService.ingestPdrStep(step);
    });

    // 4. Request Android permissions
    await _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    final statuses = await [
      Permission.locationWhenInUse,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.sensors,
      Permission.activityRecognition,
    ].request();

    final bool granted = statuses[Permission.locationWhenInUse]?.isGranted == true;

    setState(() => _isPermissionsGranted = granted);

    if (granted) {
      _stepDetectorService.startListening();
    }
  }

  void _seedBuildingGraph(BuildingGraph graph) {
    graph.addNode(const BuildingNode(id: 'lab_101', label: 'Lab 101', floor: 1, position: vmath.Vector2(8.0, 6.0), type: NodeType.room));
    graph.addNode(const BuildingNode(id: 'conf_a', label: 'Conf Room A', floor: 1, position: vmath.Vector2(25.0, 6.0), type: NodeType.room));
    graph.addNode(const BuildingNode(id: 'cafeteria', label: 'Cafeteria', floor: 1, position: vmath.Vector2(8.0, 20.0), type: NodeType.room));
    graph.addNode(const BuildingNode(id: 'exec_suite', label: 'Exec Suite', floor: 1, position: vmath.Vector2(25.0, 20.0), type: NodeType.room));
    graph.addNode(const BuildingNode(id: 'atrium', label: 'Central Atrium', floor: 1, position: vmath.Vector2(16.0, 13.0), type: NodeType.atrium));
    graph.addNode(const BuildingNode(id: 'corr_n', label: 'North Corridor', floor: 1, position: vmath.Vector2(16.0, 6.0), type: NodeType.corridor));
    graph.addNode(const BuildingNode(id: 'corr_s', label: 'South Corridor', floor: 1, position: vmath.Vector2(16.0, 20.0), type: NodeType.corridor));

    graph.addEdge('atrium', 'corr_n');
    graph.addEdge('atrium', 'corr_s');
    graph.addEdge('corr_n', 'lab_101');
    graph.addEdge('corr_n', 'conf_a');
    graph.addEdge('corr_s', 'cafeteria');
    graph.addEdge('corr_s', 'exec_suite');
  }

  @override
  void dispose() {
    _stepDetectorService.dispose();
    _fusionService.dispose();
    _syncService?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Indoor Multi-User Engine',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF070B14),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF06B6D4),
          secondary: Color(0xFF3B82F6),
          surface: Color(0xFF0D1424),
        ),
      ),
      // Auth Gate: StreamBuilder listens to live Supabase Auth state
      home: StreamBuilder<AuthState>(
        stream: _authService.authStateChanges,
        builder: (context, snapshot) {
          final session = snapshot.data?.session ?? Supabase.instance.client.auth.currentSession;

          if (session == null) {
            return AuthScreen(authService: _authService);
          }

          // User is authenticated; initialize SupabaseSyncService with user identity
          final user = session.user;
          _syncService ??= SupabaseSyncService(
            currentUserId: user.id,
            currentUserName: user.userMetadata?['full_name'] as String? ?? user.email?.split('@').first ?? 'User',
          )..joinFloorChannel(1);

          return IndoorMapScreen(
            authService: _authService,
            fusionService: _fusionService,
            stepDetectorService: _stepDetectorService,
            syncService: _syncService!,
            buildingGraph: _buildingGraph,
          );
        },
      ),
    );
  }
}
`
  }
];
