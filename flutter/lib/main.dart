// Copyright (c) 2018, the Zefyr project authors.  Please see the AUTHORS file
// for details. All rights reserved. Use of this source code is governed by a
// BSD-style license that can be found in the LICENSE file.
import 'package:flutter/material.dart';

import 'src/full_page.dart';

void main() {
  runApp(new ZefyrApp());
}

class ZefyrApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Zefyr Editor',
      theme: ThemeData(primarySwatch: Colors.cyan),
      home: FullPageEditorScreen(),
    );
  }
}
